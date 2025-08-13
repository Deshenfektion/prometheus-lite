import { query } from '../../db/pool.js';
import { metricCatalog } from '../../services/metricCatalog.js';
import { serviceDirectory } from '../../services/serviceDirectory.js';
import type { Aggregation, Comparison } from '../../types/alerts.js';

export async function createService(slug: string, environment = 'production'): Promise<number> {
  const result = await query<{ id: number }>(
    `INSERT INTO services (slug, display_name, base_url, environment, poll_interval_seconds)
     VALUES ($1, $2, $3, $4, 10)
     RETURNING id`,
    [slug, slug, `http://${slug}:8080`, environment],
  );
  serviceDirectory.invalidate();
  return (result.rows[0] as { id: number }).id;
}

export async function metricId(key: string): Promise<number> {
  const definition = await metricCatalog.resolveKey(key);
  if (definition === undefined) {
    throw new Error(`unknown metric '${key}' in fixtures`);
  }
  return definition.id;
}

export interface RuleFixture {
  name: string;
  metricKey: string;
  serviceId?: number | null;
  comparison?: Comparison;
  aggregation?: Aggregation;
  windowSeconds?: number;
  forSeconds?: number;
  warning?: number | null;
  critical?: number | null;
  enabled?: boolean;
}

export async function createRule(fixture: RuleFixture): Promise<number> {
  const result = await query<{ id: number }>(
    `INSERT INTO alert_rules (
       name, service_id, metric_id, comparison, aggregation,
       window_seconds, for_seconds, warning_threshold, critical_threshold, enabled
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      fixture.name,
      fixture.serviceId ?? null,
      await metricId(fixture.metricKey),
      fixture.comparison ?? 'ABOVE',
      fixture.aggregation ?? 'avg',
      fixture.windowSeconds ?? 60,
      fixture.forSeconds ?? 0,
      fixture.warning ?? null,
      fixture.critical ?? null,
      fixture.enabled ?? true,
    ],
  );
  return (result.rows[0] as { id: number }).id;
}

export async function writeSamples(
  serviceId: number,
  metricKey: string,
  samples: Array<{ at: Date; value: number }>,
): Promise<void> {
  const id = await metricId(metricKey);

  await query(
    `INSERT INTO metric_snapshots (service_id, metric_id, recorded_at, value)
     SELECT $1, $2, * FROM UNNEST($3::timestamptz[], $4::double precision[])
     ON CONFLICT DO NOTHING`,
    [serviceId, id, samples.map((sample) => sample.at), samples.map((sample) => sample.value)],
  );
}

export function samplesEvery(
  seconds: number,
  count: number,
  endingAt: Date,
  value: number | ((index: number) => number),
): Array<{ at: Date; value: number }> {
  return Array.from({ length: count }, (_, index) => ({
    at: new Date(endingAt.getTime() - (count - 1 - index) * seconds * 1000),
    value: typeof value === 'function' ? value(index) : value,
  }));
}
