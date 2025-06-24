import type { Queryable } from '../db/queryable.js';
import { pool } from '../db/pool.js';
import type { MetricPoint } from '../types/metrics.js';

export const INSERT_CHUNK_SIZE = 5_000;

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

      const result = await this.db.query(INSERT_CHUNK, [
        serviceIds,
        metricIds,
        timestamps,
        values,
      ]);
      written += result.rowCount ?? 0;
    }

    return written;
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
