/* ============================================================
   CBT.AI Backend — Rate Limiting Middleware
   Per-IP general and generation limits to prevent abuse
   ============================================================ */

import { rateLimit } from 'express-rate-limit';

export const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a few minutes before trying again.' },
});

export const generationLimiter = rateLimit({
  windowMs: parseInt(process.env.GENERATION_LIMIT_WINDOW_MS || '3600000', 10), // 1 hour
  max: parseInt(process.env.GENERATION_LIMIT_MAX || '10', 10), // 10 exams per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Generation limit reached. You can generate up to 10 exams per hour. Please try again later.' },
  keyGenerator: (req) => req.ip || 'unknown',
});
