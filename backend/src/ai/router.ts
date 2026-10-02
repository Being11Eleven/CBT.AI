/* ============================================================
   CBT.AI Backend — Smart Quota-Aware Budget Router
   Deterministic ranking:
   1. FREE_ONLY check (strict zero-paid-AI guarantee)
   2. Capability match (JSON, math, reasoning, context)
   3. Pre-flight capacity check (reject exhausted/insufficient candidates)
   4. Health and cooldown check
   5. Latency & priority score ranking
   Fast failover across eligible candidates.
   ============================================================ */

import { logger } from '../logging/logger.js';
import { ModelEndpointSpec, FREE_PROVIDER_ENDPOINTS } from './catalog.js';
import { quotaEngine, EndpointQuotaState } from './quota-engine.js';

export interface TaskRequirements {
  estimatedInputTokens: number;
  expectedOutputTokens: number;
  requireJson?: boolean;
  requireMath?: boolean;
  requireReasoning?: boolean;
  requireVision?: boolean;
  temperature?: number;
  preferredProvider?: string;
  globalDeadlineMs?: number; // timestamp when entire exam generation must stop
}

export interface RouteExecutionResult {
  content: string;
  endpointId: string;
  provider: string;
  model: string;
  latencyMs: number;
  fallbackCount: number;
  tokensUsed: number;
}

export class SmartRouter {
  private freeOnly: boolean;
  private providerTimeoutMs: number;

  constructor() {
    this.freeOnly = (process.env.FREE_ONLY || 'true').toLowerCase() === 'true';
    this.providerTimeoutMs = parseInt(process.env.PROVIDER_TIMEOUT_MS || '35000', 10); // 35s per provider attempt
  }

  /**
   * Filter and score candidate endpoints based on task requirements.
   */
  public selectCandidateEndpoints(task: TaskRequirements): ModelEndpointSpec[] {
    const totalRequiredTokens = task.estimatedInputTokens + task.expectedOutputTokens;

    const candidates = FREE_PROVIDER_ENDPOINTS.filter(spec => {
      // 1. FREE_ONLY filter
      if (this.freeOnly && !spec.isFree) {
        return false;
      }

      // 2. Capability filters
      if (task.requireJson && !spec.capabilities.supportsJson) return false;
      if (task.requireMath && !spec.capabilities.supportsMath) return false;
      if (task.requireReasoning && !spec.capabilities.supportsReasoning) return false;
      if (task.requireVision && !spec.capabilities.supportsVision) return false;

      // 3. Context window check
      if (spec.capabilities.contextWindow < totalRequiredTokens) return false;
      if (spec.capabilities.maxOutputTokens < task.expectedOutputTokens) return false;

      // 4. Pre-flight quota capacity check
      const hasCapacity = quotaEngine.hasSufficientCapacity(spec.endpointId, totalRequiredTokens);
      if (!hasCapacity) {
        return false;
      }

      return true;
    });

    // 5. Deterministic scoring
    const scored = candidates.map(spec => {
      const state = quotaEngine.getState(spec.endpointId);
      let score = spec.priorityScore;

      if (state) {
        // Bonus for large remaining token headroom
        if (state.tokensRemaining !== undefined) {
          const headroomRatio = Math.min(2.0, state.tokensRemaining / Math.max(1, totalRequiredTokens));
          score += headroomRatio * 20;
        }

        // Penalty for high latency (above 2000ms)
        if (state.recentLatencyMs > 2000) {
          score -= Math.min(30, (state.recentLatencyMs - 2000) / 200);
        }

        // Heavy penalty if previous failure occurred recently
        if (state.failureCount > 0) {
          score -= state.failureCount * 25;
        }
      }

      // Preferred provider hint if specified
      if (task.preferredProvider && spec.provider === task.preferredProvider) {
        score += 30;
      }

      return { spec, score };
    });

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    return scored.map(s => s.spec);
  }

  /**
   * Execute task across candidate endpoints with fast failover and bounded timeouts.
   */
  public async executeWithFailover(
    systemPrompt: string,
    userPrompt: string,
    task: TaskRequirements,
    callEndpointFn: (
      spec: ModelEndpointSpec,
      systemPrompt: string,
      userPrompt: string,
      timeoutMs: number,
      signal: AbortSignal
    ) => Promise<{ content: string; tokensUsed?: number; headers?: Record<string, string | string[] | undefined> }>
  ): Promise<RouteExecutionResult> {
    const candidates = this.selectCandidateEndpoints(task);

    if (candidates.length === 0) {
      if (this.freeOnly) {
        throw new Error(
          'All free AI provider endpoints are currently on cooldown or quota-exhausted. ' +
          'Free-only mode is active to prevent unwanted charges. Please wait a moment for quotas to reset.'
        );
      }
      throw new Error('No eligible AI provider endpoints available matching the required task capabilities.');
    }

    const errors: string[] = [];
    let fallbackCount = 0;

    for (const spec of candidates) {
      // Check global deadline: do not start a provider attempt if less than 10 seconds remain
      if (task.globalDeadlineMs && Date.now() + 10000 >= task.globalDeadlineMs) {
        throw new Error('Global 8-minute generation deadline reached. Aborting provider dispatch.');
      }

      const start = Date.now();
      const controller = new AbortController();

      // Bound provider timeout to not exceed remaining global deadline
      let effectiveTimeoutMs = this.providerTimeoutMs;
      if (task.globalDeadlineMs) {
        const remainingGlobalMs = task.globalDeadlineMs - Date.now() - 2000;
        effectiveTimeoutMs = Math.max(5000, Math.min(this.providerTimeoutMs, remainingGlobalMs));
      }

      const timeoutTimer = setTimeout(() => controller.abort(), effectiveTimeoutMs);

      try {
        logger.info({
          endpointId: spec.endpointId,
          provider: spec.provider,
          model: spec.model,
          fallbackCount,
          timeoutMs: effectiveTimeoutMs,
        }, 'Dispatching request to candidate endpoint');

        const response = await callEndpointFn(spec, systemPrompt, userPrompt, effectiveTimeoutMs, controller.signal);
        clearTimeout(timeoutTimer);

        const latencyMs = Date.now() - start;
        const estimatedTokens = response.tokensUsed ||
          Math.ceil((systemPrompt.length + userPrompt.length) / 4) + Math.ceil(response.content.length / 4);

        // Record success in quota engine
        quotaEngine.recordSuccess(spec.endpointId, estimatedTokens, latencyMs, response.headers);

        logger.info({
          endpointId: spec.endpointId,
          latencyMs,
          fallbackCount,
        }, 'AI endpoint call succeeded');

        return {
          content: response.content,
          endpointId: spec.endpointId,
          provider: spec.provider,
          model: spec.model,
          latencyMs,
          fallbackCount,
          tokensUsed: estimatedTokens,
        };
      } catch (err: unknown) {
        clearTimeout(timeoutTimer);
        const latencyMs = Date.now() - start;
        const isAbort = (err as Error)?.name === 'AbortError';
        const msg = isAbort ? `Timeout after ${effectiveTimeoutMs}ms` : (err as Error)?.message || String(err);
        const isRateLimit = msg.includes('429') || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('quota');

        logger.warn({
          endpointId: spec.endpointId,
          error: msg,
          latencyMs,
          isRateLimit,
        }, 'AI endpoint candidate failed — recording cooldown');

        quotaEngine.recordFailure(spec.endpointId, msg, isRateLimit);
        errors.push(`${spec.endpointId}: ${msg}`);
        fallbackCount++;
        // Immediately loop to next eligible candidate
      }
    }

    throw new Error(`All candidate AI providers failed:\n${errors.join('\n')}`);
  }
}

export const smartRouter = new SmartRouter();
