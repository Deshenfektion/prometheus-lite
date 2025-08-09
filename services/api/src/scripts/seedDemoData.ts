import { runMigrations } from '../db/migrate.js';
import { closePool, pool } from '../db/pool.js';
import { metricRepository } from '../repositories/metricRepository.js';
import { snapshotRepository } from '../repositories/snapshotRepository.js';
import type { MetricPoint } from '../types/metrics.js';

const WINDOW_SECONDS = Number(process.env['SEED_WINDOW_SECONDS'] ?? 7200);
const STEP_SECONDS = Number(process.env['SEED_STEP_SECONDS'] ?? 10);

interface Profile {
  slug: string;
  displayName: string;
  baseUrl: string;
  environment: string;
  baseLatencyMs: number;
  latencyJitterMs: number;
  baseCpu: number;
  baseMemory: number;
  baseThroughput: number;
  failureRate: number;
  outage?: { startFraction: number; endFraction: number };
  spikeEvery?: number;
}

const PROFILES: Profile[] = [
  {
    slug: 'checkout-api',
    displayName: 'Checkout API',
    baseUrl: 'http://checkout-api:8081',
    environment: 'production',
    baseLatencyMs: 58,
    latencyJitterMs: 18,
    baseCpu: 34,
    baseMemory: 51,
    baseThroughput: 240,
    failureRate: 0.004,
    spikeEvery: 211,
  },
  {
    slug: 'search-api',
    displayName: 'Search API',
    baseUrl: 'http://search-api:8082',
    environment: 'production',
    baseLatencyMs: 320,
    latencyJitterMs: 140,
    baseCpu: 62,
    baseMemory: 74,
    baseThroughput: 95,
    failureRate: 0.06,
    spikeEvery: 173,
  },
  {
    slug: 'billing-worker',
    displayName: 'Billing Worker',
    baseUrl: 'http://billing-worker:8083',
    environment: 'production',
    baseLatencyMs: 90,
    latencyJitterMs: 25,
    baseCpu: 22,
    baseMemory: 44,
    baseThroughput: 12,
    failureRate: 0.01,
    outage: { startFraction: 0.42, endFraction: 0.55 },
  },
  {
    slug: 'notifications-api',
    displayName: 'Notifications API',
    baseUrl: 'http://notifications-api:8084',
    environment: 'staging',
    baseLatencyMs: 74,
    latencyJitterMs: 30,
    baseCpu: 88,
    baseMemory: 91,
    baseThroughput: 40,
    failureRate: 0.008,
  },
];

function wave(index: number, period: number, amplitude: number): number {
  return Math.sin((index / period) * Math.PI * 2) * amplitude;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function percentile(values: number[], fraction: number): number {
  const ordered = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(fraction * ordered.length);
  return ordered[Math.max(rank - 1, 0)] as number;
}

async function ensureService(profile: Profile): Promise<number> {
  const result = await pool.query<{ id: number }>(
    `INSERT INTO services (slug, display_name, base_url, environment, poll_interval_seconds)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (slug) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           base_url = EXCLUDED.base_url,
           environment = EXCLUDED.environment
     RETURNING id`,
    [profile.slug, profile.displayName, profile.baseUrl, profile.environment, STEP_SECONDS],
  );
  return (result.rows[0] as { id: number }).id;
}

function buildPoints(
  profile: Profile,
  serviceId: number,
  metricIds: Map<string, number>,
  startedAt: number,
  steps: number,
): MetricPoint[] {
  const points: MetricPoint[] = [];
  const recentLatencies: number[] = [];
  const recentFailures: boolean[] = [];

  const push = (key: string, recordedAt: Date, value: number): void => {
    const metricId = metricIds.get(key);
    if (metricId !== undefined) {
      points.push({ serviceId, metricId, recordedAt, value });
    }
  };

  for (let index = 0; index < steps; index += 1) {
    const fraction = index / steps;
    const recordedAt = new Date(startedAt + index * STEP_SECONDS * 1000);

    const inOutage =
      profile.outage !== undefined &&
      fraction >= profile.outage.startFraction &&
      fraction < profile.outage.endFraction;

    const failed = inOutage || Math.random() < profile.failureRate;
    const spiking = profile.spikeEvery !== undefined && index % profile.spikeEvery === 0;

    const latency = failed
      ? profile.baseLatencyMs * 6
      : clamp(
          profile.baseLatencyMs +
            wave(index, 180, profile.latencyJitterMs) +
            (Math.random() - 0.5) * profile.latencyJitterMs +
            (spiking ? profile.baseLatencyMs * 3.5 : 0),
          1,
          60_000,
        );

    recentLatencies.push(latency);
    recentFailures.push(failed);
    if (recentLatencies.length > 30) {
      recentLatencies.shift();
      recentFailures.shift();
    }

    push('availability', recordedAt, failed ? 0 : 1);
    push('http_status', recordedAt, failed ? 503 : 200);
    push('latency_ms', recordedAt, Number(latency.toFixed(3)));
    push(
      'latency_avg_ms',
      recordedAt,
      Number((recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length).toFixed(3)),
    );
    push('latency_p95_ms', recordedAt, Number(percentile(recentLatencies, 0.95).toFixed(3)));
    push('latency_p99_ms', recordedAt, Number(percentile(recentLatencies, 0.99).toFixed(3)));
    push(
      'error_rate',
      recordedAt,
      Number((recentFailures.filter(Boolean).length / recentFailures.length).toFixed(4)),
    );
    push(
      'cpu_percent',
      recordedAt,
      Number(clamp(profile.baseCpu + wave(index, 240, 9) + Math.random() * 4, 0, 100).toFixed(2)),
    );
    push(
      'memory_percent',
      recordedAt,
      Number(
        clamp(profile.baseMemory + wave(index, 620, 5) + Math.random() * 2, 0, 100).toFixed(2),
      ),
    );
    push(
      'throughput_rps',
      recordedAt,
      Number(
        clamp(
          (inOutage ? 0 : profile.baseThroughput) + wave(index, 300, profile.baseThroughput * 0.25),
          0,
          1_000_000,
        ).toFixed(2),
      ),
    );
  }

  return points;
}

const DEFAULT_RULES: Array<{
  name: string;
  description: string;
  metricKey: string;
  comparison: 'ABOVE' | 'BELOW';
  windowSeconds: number;
  forSeconds: number;
  warning: number;
  critical: number;
}> = [
  {
    name: 'Service unreachable',
    description: 'Some or all probes in the window could not reach the service',
    metricKey: 'availability',
    comparison: 'BELOW',
    windowSeconds: 60,
    forSeconds: 30,
    warning: 0.99,
    critical: 0.5,
  },
  {
    name: 'High p95 latency',
    description: 'The 95th percentile probe latency is elevated',
    metricKey: 'latency_p95_ms',
    comparison: 'ABOVE',
    windowSeconds: 300,
    forSeconds: 120,
    warning: 500,
    critical: 1500,
  },
  {
    name: 'Elevated error rate',
    description: 'A meaningful share of probes is failing',
    metricKey: 'error_rate',
    comparison: 'ABOVE',
    windowSeconds: 300,
    forSeconds: 60,
    warning: 0.05,
    critical: 0.25,
  },
  {
    name: 'CPU saturation',
    description: 'Reported CPU utilisation is close to the limit',
    metricKey: 'cpu_percent',
    comparison: 'ABOVE',
    windowSeconds: 300,
    forSeconds: 300,
    warning: 80,
    critical: 92,
  },
  {
    name: 'Memory saturation',
    description: 'Reported memory utilisation is close to the limit',
    metricKey: 'memory_percent',
    comparison: 'ABOVE',
    windowSeconds: 300,
    forSeconds: 300,
    warning: 80,
    critical: 92,
  },
];

async function ensureDefaultRules(metricIds: Map<string, number>): Promise<number> {
  let provisioned = 0;

  for (const rule of DEFAULT_RULES) {
    const metricId = metricIds.get(rule.metricKey);
    if (metricId === undefined) {
      continue;
    }

    await pool.query(
      `INSERT INTO alert_rules (
         name, description, service_id, metric_id, comparison, aggregation,
         window_seconds, for_seconds, warning_threshold, critical_threshold
       )
       VALUES ($1, $2, NULL, $3, $4, 'avg', $5, $6, $7, $8)
       ON CONFLICT (name, COALESCE(service_id, 0)) DO UPDATE SET
         description        = EXCLUDED.description,
         comparison         = EXCLUDED.comparison,
         window_seconds     = EXCLUDED.window_seconds,
         for_seconds        = EXCLUDED.for_seconds,
         warning_threshold  = EXCLUDED.warning_threshold,
         critical_threshold = EXCLUDED.critical_threshold`,
      [
        rule.name,
        rule.description,
        metricId,
        rule.comparison,
        rule.windowSeconds,
        rule.forSeconds,
        rule.warning,
        rule.critical,
      ],
    );
    provisioned += 1;
  }

  return provisioned;
}

async function main(): Promise<void> {
  await runMigrations();

  const definitions = await metricRepository.list();
  const metricIds = new Map(definitions.map((definition) => [definition.key, definition.id]));

  const rules = await ensureDefaultRules(metricIds);
  process.stdout.write(`${rules} alert rules provisioned\n`);

  const steps = Math.floor(WINDOW_SECONDS / STEP_SECONDS);
  const startedAt = Date.now() - WINDOW_SECONDS * 1000;
  let total = 0;

  for (const profile of PROFILES) {
    const serviceId = await ensureService(profile);
    await pool.query('DELETE FROM metric_snapshots WHERE service_id = $1', [serviceId]);

    const points = buildPoints(profile, serviceId, metricIds, startedAt, steps);
    total += await snapshotRepository.insertMany(points);
    process.stdout.write(`seeded ${profile.slug}: ${points.length} points\n`);
  }

  process.stdout.write(`${total.toLocaleString('en-US')} points written\n`);
  await closePool();
}

await main();
