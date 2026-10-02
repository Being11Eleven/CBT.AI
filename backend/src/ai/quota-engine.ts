/* ============================================================
   CBT.AI Backend — Smart Quota & Health Engine
   Tracks per-endpoint requests, tokens, rate limits, cooldowns,
   generic reset schedules, and pre-flight capacity estimates.
   Distinguishes exact header-reported vs estimated quotas.
   NO polling storm: event-driven + cached + scheduled resets.
   ============================================================ */

import { logger } from '../logging/logger.js';
import { ModelEndpointSpec, FREE_PROVIDER_ENDPOINTS, ResetType } from './catalog.js';

export type QuotaSource = 'header' | 'estimated' | 'unknown';

export interface EndpointQuotaState {
  endpointId: string;
  provider: string;
  model: string;
  family: string;
  isFree: boolean;

  // Usage counters
  requestsUsedToday: number;
  requestsUsedThisMinute: number;
  tokensUsedToday: number;
  tokensUsedThisMinute: number;

  // Remaining capacity (exact or estimated)
  requestsRemaining?: number;
  tokensRemaining?: number;
  quotaSource: QuotaSource;

  // Rate limit states
  rpmLimit?: number;
  tpmLimit?: number;
  rpdLimit?: number;
  tpdLimit?: number;

  // Reset information
  resetAt?: number;           // Unix timestamp in ms when quota resets
  resetType: ResetType;

  // Health and cooldown
  isAvailable: boolean;
  failureCount: number;
  lastSuccess?: number;
  lastFailure?: number;
  failureReason?: string;
  cooldownUntil?: number;

  // Latency & performance
  recentLatencyMs: number;    // Exponential moving average
  successCount: number;
}

class QuotaEngine {
  private states = new Map<string, EndpointQuotaState>();
  private defaultCooldownMs = parseInt(process.env.PROVIDER_COOLDOWN_MS || '120000', 10);
  private resetTimers = new Map<string, NodeJS.Timeout>();

  constructor() {
    this.initializeFromCatalog();
    this.startMinuteResetTicker();
  }

  /**
   * Initialize state for all known endpoints from catalog.
   */
  private initializeFromCatalog() {
    for (const spec of FREE_PROVIDER_ENDPOINTS) {
      this.initEndpointState(spec);
    }
  }

  public initEndpointState(spec: ModelEndpointSpec): EndpointQuotaState {
    const existing = this.states.get(spec.endpointId);
    if (existing) return existing;

    const now = Date.now();
    let initialResetAt: number | undefined;

    if (spec.resetType === 'per_minute') {
      initialResetAt = (Math.floor(now / 60000) + 1) * 60000;
    } else if (spec.resetType === 'daily_fixed') {
      // Default to next midnight UTC if unknown, but updated dynamically from headers
      const tomorrow = new Date(now);
      tomorrow.setUTCHours(24, 0, 0, 0);
      initialResetAt = tomorrow.getTime();
    }

    const state: EndpointQuotaState = {
      endpointId: spec.endpointId,
      provider: spec.provider,
      model: spec.model,
      family: spec.family,
      isFree: spec.isFree,
      requestsUsedToday: 0,
      requestsUsedThisMinute: 0,
      tokensUsedToday: 0,
      tokensUsedThisMinute: 0,
      requestsRemaining: spec.defaultRpd || spec.defaultRpm,
      tokensRemaining: spec.defaultTpd || spec.defaultTpm || (spec.isFree ? 200000 : 0),
      quotaSource: 'estimated', // Initially estimated until headers observed
      rpmLimit: spec.defaultRpm,
      tpmLimit: spec.defaultTpm,
      rpdLimit: spec.defaultRpd,
      tpdLimit: spec.defaultTpd,
      resetAt: initialResetAt,
      resetType: spec.resetType,
      isAvailable: true,
      failureCount: 0,
      recentLatencyMs: 400, // baseline assumption
      successCount: 0,
    };

    this.states.set(spec.endpointId, state);
    this.scheduleResetTimer(state);
    return state;
  }

  public getState(endpointId: string): EndpointQuotaState | undefined {
    return this.states.get(endpointId);
  }

  public getAllStates(): EndpointQuotaState[] {
    return Array.from(this.states.values());
  }

  /**
   * Pre-flight check: Can this candidate satisfy the estimated token requirement?
   */
  public hasSufficientCapacity(endpointId: string, estimatedRequiredTokens: number): boolean {
    const state = this.states.get(endpointId);
    if (!state) return false;

    // Check cooldown
    if (state.cooldownUntil && Date.now() < state.cooldownUntil) {
      return false;
    }

    // Check minute RPM limit
    if (state.rpmLimit && state.requestsUsedThisMinute >= state.rpmLimit) {
      return false;
    }

    // Check minute TPM limit
    if (state.tpmLimit && (state.tokensUsedThisMinute + estimatedRequiredTokens) > state.tpmLimit) {
      return false;
    }

    // Check daily / total remaining token budget
    if (state.tokensRemaining !== undefined) {
      // Must have enough estimated headroom for the requested workload
      if (state.tokensRemaining < estimatedRequiredTokens) {
        logger.debug({
          endpointId,
          tokensRemaining: state.tokensRemaining,
          required: estimatedRequiredTokens,
        }, 'Pre-flight capacity check: insufficient tokens remaining');
        return false;
      }
    }

    // Check daily request budget
    if (state.requestsRemaining !== undefined && state.requestsRemaining <= 0) {
      return false;
    }

    return true;
  }

  /**
   * Event-driven: Record request completion and consume quota.
   * If headers provided, record EXACT values. Otherwise update ESTIMATE.
   */
  public recordSuccess(
    endpointId: string,
    tokensUsed: number,
    durationMs: number,
    headers?: Record<string, string | string[] | undefined>
  ) {
    const state = this.states.get(endpointId);
    if (!state) return;

    state.isAvailable = true;
    state.failureCount = 0;
    state.lastSuccess = Date.now();
    state.cooldownUntil = undefined;
    state.successCount++;

    // Update moving average latency
    state.recentLatencyMs = Math.round(0.7 * state.recentLatencyMs + 0.3 * durationMs);

    // Consume local counters
    state.requestsUsedToday++;
    state.requestsUsedThisMinute++;
    state.tokensUsedToday += tokensUsed;
    state.tokensUsedThisMinute += tokensUsed;

    // Check for rate-limit response headers
    let headerUpdated = false;
    if (headers) {
      headerUpdated = this.parseRateLimitHeaders(state, headers);
    }

    // If headers did not supply remaining quota, decrement local estimate
    if (!headerUpdated && state.tokensRemaining !== undefined) {
      state.tokensRemaining = Math.max(0, state.tokensRemaining - tokensUsed);
      if (state.requestsRemaining !== undefined) {
        state.requestsRemaining = Math.max(0, state.requestsRemaining - 1);
      }
      state.quotaSource = 'estimated';
    }
  }

  /**
   * Parse standard provider rate-limit headers.
   */
  private parseRateLimitHeaders(state: EndpointQuotaState, headers: Record<string, unknown>): boolean {
    let updated = false;

    const findHeader = (patterns: string[]): string | undefined => {
      for (const key of Object.keys(headers)) {
        const lower = key.toLowerCase();
        for (const p of patterns) {
          if (lower === p) {
            const val = headers[key];
            return Array.isArray(val) ? val[0] : (typeof val === 'string' ? val : undefined);
          }
        }
      }
      return undefined;
    };

    // Remaining tokens header
    const tokenHeader = findHeader([
      'x-ratelimit-remaining-tokens',
      'ratelimit-remaining-tokens',
      'x-ratelimit-tokens-remaining',
    ]);
    if (tokenHeader) {
      const parsed = parseInt(tokenHeader, 10);
      if (!isNaN(parsed)) {
        state.tokensRemaining = parsed;
        state.quotaSource = 'header'; // Exact provider reported!
        updated = true;
      }
    }

    // Remaining requests header
    const reqHeader = findHeader([
      'x-ratelimit-remaining-requests',
      'ratelimit-remaining-requests',
      'x-ratelimit-remaining',
      'ratelimit-remaining',
    ]);
    if (reqHeader) {
      const parsed = parseInt(reqHeader, 10);
      if (!isNaN(parsed)) {
        state.requestsRemaining = parsed;
        state.quotaSource = 'header';
        updated = true;
      }
    }

    // Reset time header
    const resetHeader = findHeader([
      'x-ratelimit-reset-requests',
      'x-ratelimit-reset-tokens',
      'x-ratelimit-reset',
      'ratelimit-reset',
      'retry-after',
    ]);
    if (resetHeader) {
      const parsed = parseFloat(resetHeader);
      if (!isNaN(parsed)) {
        // Can be either unix seconds (e.g. 1740000000) or delta seconds (e.g. 23.5)
        const now = Date.now();
        if (parsed > 1000000000) {
          state.resetAt = Math.round(parsed * 1000);
        } else {
          state.resetAt = now + Math.round(parsed * 1000);
        }
        this.scheduleResetTimer(state);
      }
    }

    return updated;
  }

  /**
   * Record failure and trigger cooldown.
   */
  public recordFailure(endpointId: string, reason: string, isRateLimit = false, retryAfterSeconds?: number) {
    const state = this.states.get(endpointId);
    if (!state) return;

    state.failureCount++;
    state.lastFailure = Date.now();
    state.failureReason = reason;

    // Determine cooldown duration
    let cooldownMs = this.defaultCooldownMs;
    if (retryAfterSeconds && retryAfterSeconds > 0) {
      cooldownMs = retryAfterSeconds * 1000;
    } else if (isRateLimit) {
      // 429 rate limit backoff: progressively longer or wait until resetAt if known
      if (state.resetAt && state.resetAt > Date.now()) {
        cooldownMs = Math.min(state.resetAt - Date.now(), 300000); // max 5 min
      } else {
        cooldownMs = Math.min(this.defaultCooldownMs * Math.pow(2, state.failureCount - 1), 600000);
      }
      // If 429, zero out immediate capacity
      if (state.requestsRemaining !== undefined) state.requestsRemaining = 0;
    }

    state.cooldownUntil = Date.now() + cooldownMs;
    state.isAvailable = false;

    logger.warn({
      endpointId,
      reason,
      failureCount: state.failureCount,
      cooldownMs,
      cooldownUntil: new Date(state.cooldownUntil).toISOString(),
    }, 'Endpoint failure recorded — entered cooldown');
  }

  /**
   * Schedule reset timer for endpoint.
   */
  private scheduleResetTimer(state: EndpointQuotaState) {
    if (!state.resetAt) return;

    const existing = this.resetTimers.get(state.endpointId);
    if (existing) clearTimeout(existing);

    const delay = Math.max(100, state.resetAt - Date.now());
    if (delay > 24 * 60 * 60 * 1000) return; // don't schedule >24h in advance

    const timer = setTimeout(() => {
      this.handleReset(state.endpointId);
    }, delay);

    this.resetTimers.set(state.endpointId, timer);
  }

  /**
   * Handle quota reset event at scheduled reset time.
   */
  public handleReset(endpointId: string) {
    const state = this.states.get(endpointId);
    if (!state) return;

    logger.info({ endpointId, resetType: state.resetType }, 'Executing scheduled quota reset for endpoint');

    // Reset daily counters
    state.requestsUsedToday = 0;
    state.tokensUsedToday = 0;

    // Restore estimated quota
    if (state.rpdLimit) state.requestsRemaining = state.rpdLimit;
    if (state.tpdLimit) state.tokensRemaining = state.tpdLimit;
    else state.tokensRemaining = state.isFree ? 200000 : 0;

    state.quotaSource = 'estimated';

    // Clear cooldown if it was due to quota expiration
    if (state.cooldownUntil && state.cooldownUntil <= Date.now() + 5000) {
      state.cooldownUntil = undefined;
      state.isAvailable = true;
      state.failureCount = 0;
    }

    // Schedule next reset
    const now = Date.now();
    if (state.resetType === 'daily_fixed') {
      const tomorrow = new Date(now);
      tomorrow.setUTCHours(24, 0, 0, 0);
      state.resetAt = tomorrow.getTime();
      this.scheduleResetTimer(state);
    }
  }

  /**
   * Minute reset ticker for RPM and TPM limits.
   */
  private startMinuteResetTicker() {
    setInterval(() => {
      const now = Date.now();
      for (const state of this.states.values()) {
        state.requestsUsedThisMinute = 0;
        state.tokensUsedThisMinute = 0;

        // If cooldown has expired, re-enable endpoint
        if (state.cooldownUntil && now >= state.cooldownUntil) {
          state.cooldownUntil = undefined;
          state.isAvailable = true;
          logger.info({ endpointId: state.endpointId }, 'Endpoint cooldown expired — restored to active pool');
        }
      }
    }, 60000);
  }

  /**
   * Manually override or register a dynamic endpoint (e.g. from FreeLLMAPI /v1/models discovery).
   */
  public registerDynamicEndpoint(spec: ModelEndpointSpec) {
    this.initEndpointState(spec);
  }
}

export const quotaEngine = new QuotaEngine();
