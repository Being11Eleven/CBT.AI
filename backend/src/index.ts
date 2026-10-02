/* ============================================================
   CBT.AI Backend — Express Application Entry Point
   Handles security, CORS, rate limiting, routing
   ============================================================ */
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import generateRouter from './api/generate.js';
import healthRouter from './api/health.js';
import { generalLimiter } from './security/rate-limit.js';
import { logger } from './logging/logger.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ── Allowed origins ──────────────────────────────────────────────
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:4173,http://localhost:5173';
const isDev = process.env.NODE_ENV !== 'production';

// ── Security headers ────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Allow fonts/assets
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
}));

// ── CORS ─────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    // Allow no-origin (Postman, curl) in dev only
    if (!origin && isDev) return callback(null, true);
    if (!origin) return callback(new Error('No origin header'));

    const allowed = ALLOWED_ORIGIN.split(',').map(s => s.trim());
    if (allowed.includes(origin) || allowed.includes('*')) {
      callback(null, true);
    } else {
      logger.warn({ origin }, 'CORS rejected request');
      callback(new Error(`Origin not allowed: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-Admin-Key'],
  maxAge: 86400,
}));



// ── Body parsing ─────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ── Request logging ──────────────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
      ip: req.ip,
    }, 'Request');
  });
  next();
});

// ── Routes ───────────────────────────────────────────────────────
app.use('/api/health', generalLimiter, healthRouter);
// Note: generalLimiter covers /api/generate; generationLimiter is applied specifically to POST / inside generateRouter
app.use('/api/generate', generalLimiter, generateRouter);

// ── 404 handler ──────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Global error handler ─────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err: err.message, stack: err.stack }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start server ─────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info({
    port: PORT,
    env: process.env.NODE_ENV || 'development',
    origin: ALLOWED_ORIGIN,
    freeOnly: process.env.FREE_ONLY || 'true',
    generationLimitPerHour: process.env.GENERATION_LIMIT_MAX || 10,
  }, 'CBT.AI Backend started');
});

export default app;
