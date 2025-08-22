import type { Queryable } from '../db/queryable.js';
import { pool } from '../db/pool.js';
import type { MetricPoint } from '../types/metrics.js';
import type { Aggregation } from '../types/alerts.js';
import type {
  AggregateRequest,
  AggregatedRow,
  HistoryRequest,
  HistoryRow,
  LatestValue,
} from '../types/query.js';

export const INSERT_CHUNK_SIZE = 5_000;

const AGGREGATE_EXPRESSIONS: Record<Aggregation, string> = {
  avg: 'avg(value)',
  max: 'max(value)',
  min: 'min(value)',
  last: 'max(value)',
};

export interface WindowAggregateRequest {
  metricId: number;
  aggregation: Aggregation;
  from: Date;
  to: Date;
  serviceIds?: number[];
}

export interface WindowAggregateRow {
  serviceId: number;
  value: number;
  samples: number;
}

const INSERT_CHUNK = `
  INSERT INTO metric_snapshots (service_id, metric_id, recorded_at, value)
  SELECT * FROM UNNEST(
    $1::bigint[],
    $2::smallint[],
    $3::timestamptz[],
    $4::double precision[]
  )
  ON CONFLICT (service_id, metric_id, recorded_at) DO NOTHING
`;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export class SnapshotRepository {
  private readonly db: Queryable;

  constructor(db: Queryable = pool) {
    this.db = db;
  }

  async insertMany(points: readonly MetricPoint[]): Promise<number> {
    if (points.length === 0) {
      return 0;
    }

    let written = 0;

    for (const batch of chunk(points, INSERT_CHUNK_SIZE)) {
      const serviceIds = new Array<number>(batch.length);
      const metricIds = new Array<number>(batch.length);
      const timestamps = new Array<Date>(batch.length);
      const values = new Array<number>(batch.length);

      for (let index = 0; index < batch.length; index += 1) {
        const point = batch[index] as MetricPoint;
        serviceIds[index] = point.serviceId;
        metricIds[index] = point.metricId;
        timestamps[index] = point.recordedAt;
        values[index] = point.value;
      }

      const result = await this.db.query(INSERT_CHUNK, [serviceIds, metricIds, timestamps, values]);
      written += result.rowCount ?? 0;
    }

    return written;
  }

  async latestValues(serviceIds: readonly number[]): Promise<LatestValue[]> {
    if (serviceIds.length === 0) {
      return [];
    }

    const result = await this.db.query<{
      service_id: number;
      metric_id: number;
      recorded_at: Date;
      value: number;
    }>(
      `SELECT sv.id AS service_id, m.id AS metric_id, latest.recorded_at, latest.value
         FROM services sv
         CROSS JOIN metrics m
         CROSS JOIN LATERAL (
           SELECT recorded_at, value
             FROM metric_snapshots ms
            WHERE ms.service_id = sv.id
              AND ms.metric_id = m.id
            ORDER BY ms.recorded_at DESC
            LIMIT 1
         ) latest
        WHERE sv.id = ANY($1::bigint[])`,
      [serviceIds],
    );

    return result.rows.map((row) => ({
      serviceId: row.service_id,
      metricId: row.metric_id,
      recordedAt: row.recorded_at.toISOString(),
      value: row.value,
    }));
  }

  async history(request: HistoryRequest): Promise<HistoryRow[]> {
    const result = await this.db.query<{ metric_id: number; recorded_at: Date; value: number }>(
      `SELECT metric_id, recorded_at, value
         FROM metric_snapshots
        WHERE service_id = $1
          AND metric_id = ANY($2::smallint[])
          AND recorded_at >= $3
          AND recorded_at < $4
        ORDER BY metric_id ASC, recorded_at ASC
        LIMIT $5`,
      [request.serviceId, request.metricIds, request.from, request.to, request.limit],
    );

    return result.rows.map((row) => ({
      metricId: row.metric_id,
      recordedAt: row.recorded_at.toISOString(),
      value: row.value,
    }));
  }

  async aggregate(request: AggregateRequest): Promise<AggregatedRow[]> {
    const result = await this.db.query<{
      metric_id: number;
      bucket_start: Date;
      average: number;
      minimum: number;
      maximum: number;
      samples: number;
    }>(
      `SELECT metric_id,
              to_timestamp(floor(extract(epoch FROM recorded_at) / $5) * $5) AS bucket_start,
              avg(value)   AS average,
              min(value)   AS minimum,
              max(value)   AS maximum,
              count(*)::bigint AS samples
         FROM metric_snapshots
        WHERE service_id = $1
          AND metric_id = ANY($2::smallint[])
          AND recorded_at >= $3
          AND recorded_at < $4
        GROUP BY metric_id, bucket_start
        ORDER BY metric_id ASC, bucket_start ASC
        LIMIT $6`,
      [
        request.serviceId,
        request.metricIds,
        request.from,
        request.to,
        request.stepSeconds,
        request.limit,
      ],
    );

    return result.rows.map((row) => ({
      metricId: row.metric_id,
      bucketStart: row.bucket_start.toISOString(),
      average: row.average,
      minimum: row.minimum,
      maximum: row.maximum,
      samples: row.samples,
    }));
  }

  async windowAggregate(request: WindowAggregateRequest): Promise<WindowAggregateRow[]> {
    const expression = AGGREGATE_EXPRESSIONS[request.aggregation];

    if (request.aggregation === 'last') {
      const result = await this.db.query<{ service_id: number; value: number; samples: number }>(
        `SELECT DISTINCT ON (service_id) service_id, value, 1::bigint AS samples
           FROM metric_snapshots
          WHERE metric_id = $1
            AND recorded_at >= $2
            AND recorded_at < $3
            AND ($4::bigint[] IS NULL OR service_id = ANY($4::bigint[]))
          ORDER BY service_id, recorded_at DESC`,
        [request.metricId, request.from, request.to, request.serviceIds ?? null],
      );
      return result.rows.map((row) => ({
        serviceId: row.service_id,
        value: row.value,
        samples: row.samples,
      }));
    }

    const result = await this.db.query<{ service_id: number; value: number; samples: number }>(
      `SELECT service_id, ${expression} AS value, count(*)::bigint AS samples
         FROM metric_snapshots
        WHERE metric_id = $1
          AND recorded_at >= $2
          AND recorded_at < $3
          AND ($4::bigint[] IS NULL OR service_id = ANY($4::bigint[]))
        GROUP BY service_id`,
      [request.metricId, request.from, request.to, request.serviceIds ?? null],
    );

    return result.rows.map((row) => ({
      serviceId: row.service_id,
      value: row.value,
      samples: row.samples,
    }));
  }

  async countForService(serviceId: number): Promise<number> {
    const result = await this.db.query<{ count: number }>(
      'SELECT COUNT(*)::bigint AS count FROM metric_snapshots WHERE service_id = $1',
      [serviceId],
    );
    return result.rows[0]?.count ?? 0;
  }
}

export const snapshotRepository = new SnapshotRepository();
