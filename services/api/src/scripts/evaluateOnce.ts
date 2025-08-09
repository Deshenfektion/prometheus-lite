import { runMigrations } from '../db/migrate.js';
import { closePool } from '../db/pool.js';
import { alertEngine } from '../services/alertEngine.js';

await runMigrations();

const summary = await alertEngine.evaluate();
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

for (const alert of await alertEngine.active()) {
  process.stdout.write(
    `${alert.state.padEnd(8)} ${alert.serviceSlug.padEnd(20)} ${alert.message}\n`,
  );
}

await closePool();
