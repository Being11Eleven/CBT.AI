/* ============================================================
   CBT.AI Backend — Admin Diagnostics & Security Guards
   Guards admin telemetry behind ADMIN_API_KEY.
   Student endpoints never receive raw credentials or quota internals.
   ============================================================ */

import { Request, Response, NextFunction } from 'express';
import { quotaEngine } from '../ai/quota-engine.js';
import { getQueueStatus } from '../jobs/generator.js';
import { ECOSYSTEM_METRICS } from '../ai/catalog.js';

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const adminSecret = process.env.ADMIN_API_KEY;
  if (!adminSecret) {
    // If no admin key configured in production, lock down admin endpoints
    res.status(403).json({ error: 'Admin access not configured on this server.' });
    return;
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (req.headers['x-admin-key'] as string);

  if (!token || token !== adminSecret) {
    res.status(401).json({ error: 'Unauthorized: Invalid or missing admin credentials.' });
    return;
  }

  next();
}

/**
 * Returns comprehensive system diagnostics for administrators.
 */
export function getAdminDiagnostics() {
  const states = quotaEngine.getAllStates();
  const queue = getQueueStatus();

  return {
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
    ecosystem: ECOSYSTEM_METRICS,
    queue,
    endpoints: states.map(s => ({
      endpointId: s.endpointId,
      provider: s.provider,
      model: s.model,
      family: s.family,
      isFree: s.isFree,
      health: s.isAvailable ? 'healthy' : 'cooldown',
      cooldownUntil: s.cooldownUntil ? new Date(s.cooldownUntil).toISOString() : null,
      quotaSource: s.quotaSource,
      requestsRemaining: s.requestsRemaining ?? 'unlimited/unknown',
      tokensRemaining: s.tokensRemaining ?? 'unlimited/unknown',
      resetAt: s.resetAt ? new Date(s.resetAt).toISOString() : null,
      resetType: s.resetType,
      requestsToday: s.requestsUsedToday,
      tokensToday: s.tokensUsedToday,
      recentLatencyMs: s.recentLatencyMs,
      successCount: s.successCount,
      failureCount: s.failureCount,
      lastFailureReason: s.failureReason,
    })),
  };
}
