import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { z } from 'zod';
import { runMigrations } from '../db/migrate.js';
import { closePool, pool } from '../db/pool.js';
import { logger } from '../lib/logger.js';

const targetSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  display_name: z.string().min(1).max(120),
  base_url: z.string().url(),
  health_path: z.string().startsWith('/').optional(),
  environment: z.string().min(1).max(32).optional(),
  interval_seconds: z.number().positive().optional(),
  timeout_ms: z.number().int().positive().optional(),
  enabled: z.boolean().optional(),
});

const fileSchema = z.object({
  targets: z.array(targetSchema).min(1),
});

const path = process.env['TARGETS_FILE'] ?? 'deploy/collector.docker.yaml';

async function main(): Promise<void> {
  const parsed = fileSchema.safeParse(parse(await readFile(path, 'utf8')));

  if (!parsed.success) {
    logger.error({ path, issues: parsed.error.issues }, 'target file is not valid');
    process.exitCode = 1;
    return;
  }

  await runMigrations();

  for (const target of parsed.data.targets) {
    await pool.query(
      `INSERT INTO services (
         slug, display_name, base_url, health_path, environment, poll_interval_seconds, timeout_ms
       )
       VALUES ($1, $2, $3, COALESCE($4, '/health'), COALESCE($5, 'production'),
               COALESCE($6, 15), COALESCE($7, 3000))
       ON CONFLICT (slug) DO UPDATE SET
         display_name          = EXCLUDED.display_name,
         base_url              = EXCLUDED.base_url,
         health_path           = EXCLUDED.health_path,
         environment           = EXCLUDED.environment,
         poll_interval_seconds = EXCLUDED.poll_interval_seconds,
         timeout_ms            = EXCLUDED.timeout_ms`,
      [
        target.slug,
        target.display_name,
        target.base_url,
        target.health_path ?? null,
        target.environment ?? null,
        target.interval_seconds === undefined ? null : Math.round(target.interval_seconds),
        target.timeout_ms ?? null,
      ],
    );
  }

  logger.info({ path, count: parsed.data.targets.length }, 'targets provisioned');
  await closePool();
}

await main();
