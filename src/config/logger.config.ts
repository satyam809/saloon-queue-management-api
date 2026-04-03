import * as winston from 'winston';
import 'winston-daily-rotate-file';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// ─── Formats ───────────────────────────────────────────────────────────────

/** Human-readable format for local development. */
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, context, requestId, userId, ...meta }) => {
    const ctx     = context ?? 'App';
    const rid     = requestId ? ` [${requestId}]` : '';
    const uid     = userId    ? ` uid=${userId}`   : '';
    const extras  = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${ctx}]${rid}${uid} ${level}: ${stack ?? message}${extras}`;
  }),
);

/**
 * Structured JSON format for production.
 * Each log line is a self-contained JSON object — easy to ingest by
 * Datadog, ELK, CloudWatch Logs Insights, etc.
 */
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
);

const isDev = process.env.NODE_ENV !== 'production';

// ─── Transports ────────────────────────────────────────────────────────────

/**
 * Daily-rotate transport shared options:
 * - Files roll at midnight (datePattern YYYY-MM-DD).
 * - Each file is capped at 20 MB so a runaway process can't fill disk.
 * - Archived files are gzip-compressed to save ~70 % of disk space.
 */
const rotateBase = {
  datePattern:    'YYYY-MM-DD',
  maxSize:        '20m',
  zippedArchive:  true,
} as const;

// ─── Config export ─────────────────────────────────────────────────────────

export const winstonConfig: winston.LoggerOptions = {
  level:  process.env.LOG_LEVEL ?? 'info',
  format: isDev ? devFormat : prodFormat,
  transports: [
    // Always log to stdout — captured by Docker / systemd / PM2.
    new winston.transports.Console(),

    // Error-only file: 14-day rolling window, kept for incident post-mortems.
    new winston.transports.DailyRotateFile({
      ...rotateBase,
      filename: 'logs/error-%DATE%.log',
      level:    'error',
      maxFiles: '14d',
    }),

    // Combined file: 30-day rolling window, used for audit trails and analytics.
    new winston.transports.DailyRotateFile({
      ...rotateBase,
      filename: 'logs/combined-%DATE%.log',
      maxFiles: '30d',
    }),
  ],
};
