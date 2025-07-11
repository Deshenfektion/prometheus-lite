import { runMigrations } from '../../db/migrate.js';
import { pool, query } from '../../db/pool.js';

let prepared = false;

export async function databaseAvailable(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function prepareDatabase(): Promise<void> {
  if (prepared) {
    return;
  }
  await runMigrations();
  prepared = true;
}

export async function resetDatabase(): Promise<void> {
  await query('TRUNCATE services, users RESTART IDENTITY CASCADE');
}

export async function disconnect(): Promise<void> {
  await pool.end();
}
