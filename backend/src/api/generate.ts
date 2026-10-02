/* ============================================================
   CBT.AI Backend — Generation API Routes
   POST /api/generate — start an autonomous exam generation job
   GET  /api/generate/:jobId/events — SSE real-time stream
   GET  /api/generate/:jobId — polling status fallback
   POST /api/generate/evaluate — server-side exam evaluation
   DELETE /api/generate/:jobId — cancel job
   ============================================================ */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { extractDocument } from '../documents/extractor.js';
import {
  createJob,
  getJob,
  subscribeToJob,
  getQueueStatus,
  evaluateExamServerSide,
  type JobConfig,
  type JobDocument,
  type ExamEvaluationRequest,
} from '../jobs/generator.js';
import { generationLimiter } from '../security/rate-limit.js';
import { logger } from '../logging/logger.js';

const router = Router();

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '25', 10) * 1024 * 1024;
const ALLOWED_MIMES = (process.env.ALLOWED_MIME_TYPES || 'application/pdf,text/plain,image/jpeg,image/png,image/webp')
  .split(',').map(s => s.trim());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 4 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype) ||
        file.originalname.endsWith('.txt') ||
        file.originalname.endsWith('.md')) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}. Allowed: ${ALLOWED_MIMES.join(', ')}`));
    }
  },
});

// ── POST /api/generate ──────────────────────────────────────────
router.post(
  '/',
  generationLimiter,
  upload.fields([
    { name: 'study_material', maxCount: 1 },
    { name: 'syllabus', maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    try {
      const rawConfig = req.body.config;
      if (!rawConfig) {
        res.status(400).json({ error: 'Missing config field in request body' });
        return;
      }

      let config: JobConfig;
      try {
        config = typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig;
      } catch {
        res.status(400).json({ error: 'Invalid JSON in config field' });
        return;
      }

      const configErrors = validateConfig(config);
      if (configErrors.length > 0) {
        res.status(400).json({ error: 'Invalid configuration', details: configErrors });
        return;
      }

      // Extract documents if provided
      const documents: JobDocument[] = [];
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;

      if (files?.study_material?.[0]) {
        const f = files.study_material[0];
        try {
          const extracted = await extractDocument(f.buffer, f.originalname, f.mimetype);
          documents.push({
            filename: f.originalname,
            type: 'study_material',
            content: extracted.content,
          });
          logger.info({ filename: f.originalname, chars: extracted.content.length }, 'Study material extracted');
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Document extraction failed';
          res.status(422).json({ error: msg });
          return;
        }
      }

      if (files?.syllabus?.[0]) {
        const f = files.syllabus[0];
        try {
          const extracted = await extractDocument(f.buffer, f.originalname, f.mimetype);
          documents.push({
            filename: f.originalname,
            type: 'syllabus',
            content: extracted.content,
          });
          logger.info({ filename: f.originalname, chars: extracted.content.length }, 'Syllabus extracted');
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Syllabus extraction failed';
          res.status(422).json({ error: msg });
          return;
        }
      }

      const job = createJob(config, documents);
      logger.info({ jobId: job.id, ip: req.ip }, 'Generation job created');

      res.status(202).json({
        jobId: job.id,
        status: job.status,
        stage: job.stage,
        createdAt: job.createdAt,
        eventsUrl: `/api/generate/${job.id}/events`,
        statusUrl: `/api/generate/${job.id}`,
        message: 'Exam generation initialized. Connect to eventsUrl for real-time progress.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      logger.error({ err }, 'POST /api/generate failed');
      res.status(500).json({ error: message });
    }
  }
);

// ── GET /api/generate/:jobId/events — SSE Stream ────────────────
router.get('/:jobId/events', (req: Request, res: Response) => {
  const job = getJob(String(req.params.jobId));
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event: unknown) => {
    const data = JSON.stringify(event);
    res.write(`data: ${data}\n\n`);
    if (typeof (res as unknown as { flush?: () => void }).flush === 'function') {
      (res as unknown as { flush: () => void }).flush();
    }
  };

  // Initial comment
  res.write(': connected\n\n');

  // Subscribe to live and replayed past events
  const unsubscribe = subscribeToJob(job.id, send);

  // Heartbeat comment every 15s to keep connection alive through reverse proxies
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    logger.debug({ jobId: job.id }, 'SSE client disconnected');
  });

  if (job.status === 'complete' || job.status === 'error' || job.status === 'timeout') {
    setTimeout(() => res.end(), 200);
  }
});

// ── GET /api/generate/:jobId — Polling fallback ─────────────────
router.get('/:jobId', (req: Request, res: Response) => {
  const job = getJob(String(req.params.jobId));
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  const response: Record<string, unknown> = {
    jobId: job.id,
    status: job.status,
    stage: job.stage,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    questionCount: job.questions?.length,
    error: job.error,
    recentEvents: job.events.slice(-5),
  };

  if (job.status === 'complete' && job.questions) {
    response.questions = job.questions;
  }

  res.json(response);
});

// ── POST /api/generate/evaluate — Server-Side Evaluation ────────
router.post('/evaluate', (req: Request, res: Response) => {
  try {
    const payload = req.body as ExamEvaluationRequest;
    if (!payload || !Array.isArray(payload.questions) || !payload.responses) {
      res.status(400).json({ error: 'Invalid evaluation payload. Required: questions and responses.' });
      return;
    }

    const evaluationResult = evaluateExamServerSide(payload);
    res.json(evaluationResult);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Evaluation failed';
    logger.error({ err }, 'POST /api/generate/evaluate failed');
    res.status(500).json({ error: msg });
  }
});

// ── DELETE /api/generate/:jobId ─────────────────────────────────
router.delete('/:jobId', (req: Request, res: Response) => {
  const job = getJob(String(req.params.jobId));
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  if (job.timeoutHandle) clearTimeout(job.timeoutHandle);
  if (job.messageRotationTimer) clearInterval(job.messageRotationTimer);

  res.json({ jobId: job.id, cancelled: true });
});

// ── GET /api/generate (Queue status) ───────────────────────────
router.get('/', (_req: Request, res: Response) => {
  res.json(getQueueStatus());
});

// ── Config Validation ───────────────────────────────────────────
function validateConfig(config: Partial<JobConfig>): string[] {
  const errors: string[] = [];

  if (!config.subject || config.subject.trim().length < 1) {
    errors.push('subject is required');
  }
  if (!config.level || !config.level.id || !config.level.label) {
    errors.push('level is required (must have id and label)');
  }
  if (!config.difficulty || !['easy', 'medium', 'hard', 'extreme'].includes(config.difficulty)) {
    errors.push('difficulty must be one of: easy, medium, hard, extreme');
  }
  if (!config.questionCount || config.questionCount < 1 || config.questionCount > 200) {
    errors.push('questionCount must be between 1 and 200');
  }
  if (!config.questionTypes || config.questionTypes.length < 1) {
    errors.push('questionTypes must have at least one type');
  }
  if (!config.marking || typeof config.marking.correct !== 'number') {
    errors.push('marking scheme is required with correct, incorrect, unanswered marks');
  }

  return errors;
}

// ── Multer Error Handler ────────────────────────────────────────
router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 25}MB.` });
    } else {
      res.status(400).json({ error: err.message });
    }
  } else {
    res.status(400).json({ error: err.message });
  }
});

export default router;
