import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { findUpward } from '../lib/paths.js';
import { logger } from '../lib/logger.js';
import { closePool, pool, withTransaction } from './pool.js';

const MIGRATION_FILE_PATTERN = /^\d{3}_[a-z0-9_]+\.sql$/;

export function resolveMigrationsDir(): string {
  const fromEnv = process.env['MIGRATIONS_DIR'];
  if (fromEnv) {
    return resolve(fromEnv);
  }

  const discovered = findUpward(join('db', 'migrations'));
  if (discovered === undefined) {
    throw new Error('Unable to locate db/migrations; set MIGRATIONS_DIR');
  }
  return discovered;
}

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     TEXT PRIMARY KEY,
      checksum    TEXT NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function appliedVersions(): Promise<Map<string, string>> {
  const result = await pool.query<{ version: string; checksum: string }>(
    'SELECT version, checksum FROM schema_migrations',
  );
  return new Map(result.rows.map((row) => [row.version, row.checksum]));
}

function checksum(contents: string): string {
  return createHash('sha256').update(contents).digest('hex').slice(0, 16);
}

export async function runMigrations(): Promise<string[]> {
  const dir = resolveMigrationsDir();
  const entries = (await readdir(dir)).filter((name) => MIGRATION_FILE_PATTERN.test(name)).sort();

  await ensureMigrationsTable();
  const applied = await appliedVersions();
  const executed: string[] = [];

  for (const filename of entries) {
    const version = filename.replace(/\.sql$/, '');
    const contents = await readFile(join(dir, filename), 'utf8');
    const digest = checksum(contents);
    const previous = applied.get(version);

    if (previous !== undefined) {
      if (previous !== digest) {
        throw new Error(`Migration ${version} changed after being applied`);
      }
      continue;
    }

    await withTransaction(async (client) => {
      await client.query(contents);
      await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [
        version,
        digest,
      ]);
    });

    executed.push(version);
    logger.info({ version }, 'migration applied');
  }

  return executed;
}

const invokedDirectly = process.argv[1] !== undefined && process.argv[1].includes('migrate');

if (invokedDirectly) {
  try {
    const executed = await runMigrations();
    logger.info({ count: executed.length }, 'migrations up to date');
  } catch (error) {
    logger.error({ err: error }, 'migration failed');
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
