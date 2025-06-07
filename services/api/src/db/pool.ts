import pg from 'pg';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

const { Pool, types } = pg;

types.setTypeParser(types.builtins.INT8, (value: string) => Number.parseInt(value, 10));
types.setTypeParser(types.builtins.NUMERIC, (value: string) => Number.parseFloat(value));

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  idleTimeoutMillis: env.DATABASE_IDLE_TIMEOUT_MS,
  statement_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
  application_name: 'prometheus-lite-api',
});

pool.on('error', (error: Error) => {
  logger.error({ err: error }, 'idle postgres client errored');
});

export async function query<T extends QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params as unknown[]);
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
