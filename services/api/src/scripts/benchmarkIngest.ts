import { performance } from 'node:perf_hooks';
import { runMigrations } from '../db/migrate.js';
import { closePool, pool, withTransaction } from '../db/pool.js';
import { snapshotRepository } from '../repositories/snapshotRepository.js';
import type { MetricPoint } from '../types/metrics.js';

const POINTS = Number(process.env['BENCH_POINTS'] ?? 50_000);
const METRIC_COUNT = 8;
const BENCH_SLUG = 'benchmark-target';

async function ensureService(): Promise<number> {
  const result = await pool.query<{ id: number }>(
    `INSERT INTO services (slug, display_name, base_url)
     VALUES ($1, 'Benchmark target', 'http://benchmark.invalid')
     ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name
     RETURNING id`,
    [BENCH_SLUG],
  );
  return (result.rows[0] as { id: number }).id;
}

function buildPoints(serviceId: number, offsetMs: number): MetricPoint[] {
  const points: MetricPoint[] = [];
  const base = Date.now() - offsetMs;

  for (let index = 0; index < POINTS; index += 1) {
    points.push({
      serviceId,
      metricId: (index % METRIC_COUNT) + 1,
      recordedAt: new Date(base - Math.floor(index / METRIC_COUNT) * 1000),
      value: Math.random() * 100,
    });
  }

  return points;
}

async function insertRowByRow(points: readonly MetricPoint[]): Promise<number> {
  return withTransaction(async (client) => {
    let written = 0;
    for (const point of points) {
      const result = await client.query(
        `INSERT INTO metric_snapshots (service_id, metric_id, recorded_at, value)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (service_id, metric_id, recorded_at) DO NOTHING`,
        [point.serviceId, point.metricId, point.recordedAt, point.value],
      );
      written += result.rowCount ?? 0;
    }
    return written;
  });
}

async function measure(label: string, run: () => Promise<number>): Promise<void> {
  const started = performance.now();
  const written = await run();
  const elapsedMs = performance.now() - started;
  const perSecond = Math.round((written / elapsedMs) * 1000);
  process.stdout.write(
    `${label.padEnd(16)} ${written.toString().padStart(7)} rows  ` +
      `${elapsedMs.toFixed(0).padStart(6)} ms  ${perSecond.toLocaleString('en-US')} rows/s\n`,
  );
}

async function main(): Promise<void> {
  await runMigrations();
  const serviceId = await ensureService();
  await pool.query('DELETE FROM metric_snapshots WHERE service_id = $1', [serviceId]);

  const rowByRow = buildPoints(serviceId, 0);
  const batched = buildPoints(serviceId, 30 * 24 * 3_600_000);

  process.stdout.write(`inserting ${POINTS.toLocaleString('en-US')} points per strategy\n`);
  await measure('row-by-row', () => insertRowByRow(rowByRow));
  await measure('unnest batch', () => snapshotRepository.insertMany(batched));

  await pool.query('DELETE FROM metric_snapshots WHERE service_id = $1', [serviceId]);
  await pool.query('DELETE FROM services WHERE slug = $1', [BENCH_SLUG]);
  await closePool();
}

await main();
