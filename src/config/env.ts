import 'dotenv/config';
import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  APP_URL: z.url().default('http://localhost:3000'),
  API_URL: z.url().default('http://localhost:4000'),
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://postgres:postgres@localhost:5432/papaleki'),
  DATABASE_SSL: booleanFromString.default(false),
  COOKIE_SECRET: z.string().min(32).default('development-only-secret-change-me-123456'),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(5).max(120).default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
  INVITATION_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  STORAGE_ROOT: z.string().min(1).default('./storage'),
  MAX_AUDIO_MB: z.coerce.number().int().min(1).max(2048).default(500),
  MAX_IMAGE_MB: z.coerce.number().int().min(1).max(50).default(12),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(1000).max(60_000).default(5000),
  WORKER_API_KEY: z.string().min(32).default('development-worker-key-change-me-123456'),
  FFMPEG_PATH: z.string().default('ffmpeg'),
  FFPROBE_PATH: z.string().default('ffprobe'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
  SMTP_SECURE: booleanFromString.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('PapaLeki <noreply@example.com>'),
  TRUST_PROXY: booleanFromString.default(false),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
}).superRefine((value, context) => {
  if (value.NODE_ENV !== 'production') return;
  if (value.COOKIE_SECRET.startsWith('development-')) {
    context.addIssue({ code: 'custom', path: ['COOKIE_SECRET'], message: 'COOKIE_SECRET doit être remplacé en production.' });
  }
  if (value.WORKER_API_KEY.startsWith('development-')) {
    context.addIssue({ code: 'custom', path: ['WORKER_API_KEY'], message: 'WORKER_API_KEY doit être remplacé en production.' });
  }
});

export const env = schema.parse(process.env);
export type Environment = z.infer<typeof schema>;
