import type { Queryable } from '../db/queryable.js';
import { pool } from '../db/pool.js';
import type {
  CreateServiceInput,
  ServiceFilter,
  ServiceRecord,
  UpdateServiceInput,
} from '../types/service.js';

interface ServiceRow {
  id: number;
  slug: string;
  display_name: string;
  base_url: string;
  health_path: string;
  environment: string;
  poll_interval_seconds: number;
  timeout_ms: number;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = `
  id, slug, display_name, base_url, health_path, environment,
  poll_interval_seconds, timeout_ms, enabled, created_at, updated_at
`;

function toRecord(row: ServiceRow): ServiceRecord {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    baseUrl: row.base_url,
    healthPath: row.health_path,
    environment: row.environment,
    pollIntervalSeconds: row.poll_interval_seconds,
    timeoutMs: row.timeout_ms,
    enabled: row.enabled,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class ServiceRepository {
  private readonly db: Queryable;

  constructor(db: Queryable = pool) {
    this.db = db;
  }

  async list(filter: ServiceFilter = {}): Promise<ServiceRecord[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.environment !== undefined) {
      params.push(filter.environment);
      conditions.push(`environment = $${params.length}`);
    }
    if (filter.enabled !== undefined) {
      params.push(filter.enabled);
      conditions.push(`enabled = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.db.query<ServiceRow>(
      `SELECT ${COLUMNS} FROM services ${where} ORDER BY slug ASC`,
      params,
    );
    return result.rows.map(toRecord);
  }

  async findById(id: number): Promise<ServiceRecord | null> {
    const result = await this.db.query<ServiceRow>(
      `SELECT ${COLUMNS} FROM services WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row === undefined ? null : toRecord(row);
  }

  async findBySlug(slug: string): Promise<ServiceRecord | null> {
    const result = await this.db.query<ServiceRow>(
      `SELECT ${COLUMNS} FROM services WHERE slug = $1`,
      [slug],
    );
    const row = result.rows[0];
    return row === undefined ? null : toRecord(row);
  }

  async create(input: CreateServiceInput): Promise<ServiceRecord> {
    const result = await this.db.query<ServiceRow>(
      `INSERT INTO services (
         slug, display_name, base_url, health_path, environment,
         poll_interval_seconds, timeout_ms, enabled
       )
       VALUES ($1, $2, $3, COALESCE($4, '/health'), COALESCE($5, 'production'),
               COALESCE($6, 15), COALESCE($7, 3000), COALESCE($8, TRUE))
       RETURNING ${COLUMNS}`,
      [
        input.slug,
        input.displayName,
        input.baseUrl,
        input.healthPath ?? null,
        input.environment ?? null,
        input.pollIntervalSeconds ?? null,
        input.timeoutMs ?? null,
        input.enabled ?? null,
      ],
    );
    return toRecord(result.rows[0] as ServiceRow);
  }

  async update(id: number, patch: UpdateServiceInput): Promise<ServiceRecord | null> {
    const result = await this.db.query<ServiceRow>(
      `UPDATE services SET
         display_name          = COALESCE($2, display_name),
         base_url              = COALESCE($3, base_url),
         health_path           = COALESCE($4, health_path),
         environment           = COALESCE($5, environment),
         poll_interval_seconds = COALESCE($6, poll_interval_seconds),
         timeout_ms            = COALESCE($7, timeout_ms),
         enabled               = COALESCE($8, enabled)
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [
        id,
        patch.displayName ?? null,
        patch.baseUrl ?? null,
        patch.healthPath ?? null,
        patch.environment ?? null,
        patch.pollIntervalSeconds ?? null,
        patch.timeoutMs ?? null,
        patch.enabled ?? null,
      ],
    );
    const row = result.rows[0];
    return row === undefined ? null : toRecord(row);
  }

  async remove(id: number): Promise<boolean> {
    const result = await this.db.query('DELETE FROM services WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}

export const serviceRepository = new ServiceRepository();
