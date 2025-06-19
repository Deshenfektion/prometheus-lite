import type { Queryable } from '../db/queryable.js';
import { pool, withTransaction } from '../db/pool.js';
import type { MetricPoint } from '../types/metrics.js';

const INSERT_POINT = `
  INSERT INTO metric_snapshots (service_id, metric_id, recorded_at, value)
  VALUES ($1, $2, $3, $4)
  ON CONFLICT (service_id, metric_id, recorded_at) DO NOTHING
`;

export class SnapshotRepository {
  private readonly db: Queryable;

  constructor(db: Queryable = pool) {
    this.db = db;
  }

  async insertMany(points: readonly MetricPoint[]): Promise<number> {
    if (points.length === 0) {
      return 0;
    }

    return withTransaction(async (client) => {
      let written = 0;
      for (const point of points) {
        const result = await client.query(INSERT_POINT, [
          point.serviceId,
          point.metricId,
          point.recordedAt,
          point.value,
        ]);
        written += result.rowCount ?? 0;
      }
      return written;
    });
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
