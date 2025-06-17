import type { Queryable } from '../db/queryable.js';
import { pool } from '../db/pool.js';
import type { MetricDefinition, MetricKind } from '../types/metrics.js';

interface MetricRow {
  id: number;
  key: string;
  display_name: string;
  unit: string;
  kind: MetricKind;
  description: string;
}

function toDefinition(row: MetricRow): MetricDefinition {
  return {
    id: row.id,
    key: row.key,
    displayName: row.display_name,
    unit: row.unit,
    kind: row.kind,
    description: row.description,
  };
}

export class MetricRepository {
  private readonly db: Queryable;

  constructor(db: Queryable = pool) {
    this.db = db;
  }

  async list(): Promise<MetricDefinition[]> {
    const result = await this.db.query<MetricRow>(
      'SELECT id, key, display_name, unit, kind, description FROM metrics ORDER BY id ASC',
    );
    return result.rows.map(toDefinition);
  }
}

export const metricRepository = new MetricRepository();
