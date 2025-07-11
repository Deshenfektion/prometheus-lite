import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { findUpward } from '../lib/paths.js';

const envFile = findUpward('.env');
loadDotenv(envFile === undefined ? {} : { path: envFile });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(200).default(10),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().min(0).default(30_000),
  DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(0).default(10_000),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.coerce.number().int().min(60).max(86_400).default(3600),
  JWT_ISSUER: z.string().min(1).default('prometheus-lite'),
  INGEST_TOKEN: z.string().min(16),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env = parseEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
