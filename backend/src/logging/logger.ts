/* ============================================================
   CBT.AI Backend — Logging Module
   Structured JSON logging with Pino (falls back to console)
   ============================================================ */
import pino from 'pino';

const level = (process.env.LOG_LEVEL || 'info') as pino.Level;
const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level,
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname' } }
    : undefined,
});

export type Logger = typeof logger;
