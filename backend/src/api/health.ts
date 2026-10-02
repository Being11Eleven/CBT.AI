/* ============================================================
   CBT.AI Backend — Health & Admin Telemetry Routes
   GET /api/health — Public health check & clean AI service status
   GET /api/health/diagnostics — Protected admin diagnostics
   GET /api/health/queue — Queue status
   ============================================================ */

import { Router, Request, Response } from 'express';
import { getPublicAIStatus } from '../ai/providers.js';
import { getQueueStatus } from '../jobs/generator.js';
import { requireAdminAuth, getAdminDiagnostics } from '../security/admin.js';

const router = Router();
const startTime = Date.now();

// ── GET /api/health (Public Clean Health Check) ───────────────────
router.get('/', (_req: Request, res: Response) => {
  const aiStatus = getPublicAIStatus();

  res.json({
    status: 'ok',
    service: 'CBT.AI Universal Platform',
    version: '2.0.0',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    ai: aiStatus,
    timestamp: new Date().toISOString(),
  });
});

// ── GET /api/health/queue ────────────────────────────────────────
router.get('/queue', (_req: Request, res: Response) => {
  res.json(getQueueStatus());
});

// ── GET /api/health/diagnostics (Protected Admin Telemetry) ──────
router.get('/diagnostics', requireAdminAuth, (_req: Request, res: Response) => {
  res.json(getAdminDiagnostics());
});

export default router;
