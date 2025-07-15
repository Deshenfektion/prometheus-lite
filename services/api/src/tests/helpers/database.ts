import { runMigrations } from '../../db/migrate.js';
import { pool, query } from '../../db/pool.js';
import { metricCatalog } from '../../services/metricCatalog.js';
import { serviceDirectory } from '../../services/serviceDirectory.js';

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
  serviceDirectory.invalidate();
  metricCatalog.invalidate();
}

let closed = false;

export async function disconnect(): Promise<void> {
  if (closed) {
    return;
  }
  closed = true;
  await pool.end();
}
