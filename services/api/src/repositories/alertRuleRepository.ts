import type { Queryable } from '../db/queryable.js';
import { pool } from '../db/pool.js';
import type {
  Aggregation,
  AlertRule,
  Comparison,
  CreateAlertRuleInput,
  UpdateAlertRuleInput,
} from '../types/alerts.js';

interface AlertRuleRow {
  id: number;
  name: string;
  description: string;
  service_id: number | null;
  metric_id: number;
  metric_key: string;
  comparison: Comparison;
  aggregation: Aggregation;
  window_seconds: number;
  for_seconds: number;
  warning_threshold: number | null;
  critical_threshold: number | null;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

const SELECT_RULE = `
  SELECT r.id, r.name, r.description, r.service_id, r.metric_id, m.key AS metric_key,
         r.comparison, r.aggregation, r.window_seconds, r.for_seconds,
         r.warning_threshold, r.critical_threshold, r.enabled, r.created_at, r.updated_at
    FROM alert_rules r
    JOIN metrics m ON m.id = r.metric_id
`;

function toRule(row: AlertRuleRow): AlertRule {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    serviceId: row.service_id,
    metricId: row.metric_id,
    metricKey: row.metric_key,
    comparison: row.comparison,
    aggregation: row.aggregation,
    windowSeconds: row.window_seconds,
    forSeconds: row.for_seconds,
    warningThreshold: row.warning_threshold,
    criticalThreshold: row.critical_threshold,
    enabled: row.enabled,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class AlertRuleRepository {
  private readonly db: Queryable;

  constructor(db: Queryable = pool) {
    this.db = db;
  }

  async list(onlyEnabled = false): Promise<AlertRule[]> {
    const where = onlyEnabled ? 'WHERE r.enabled' : '';
    const result = await this.db.query<AlertRuleRow>(`${SELECT_RULE} ${where} ORDER BY r.id ASC`);
    return result.rows.map(toRule);
  }

  async findById(id: number): Promise<AlertRule | null> {
    const result = await this.db.query<AlertRuleRow>(`${SELECT_RULE} WHERE r.id = $1`, [id]);
    const row = result.rows[0];
    return row === undefined ? null : toRule(row);
  }

  async create(input: CreateAlertRuleInput & { metricId: number; serviceId: number | null }) {
    const result = await this.db.query<{ id: number }>(
      `INSERT INTO alert_rules (
         name, description, service_id, metric_id, comparison, aggregation,
         window_seconds, for_seconds, warning_threshold, critical_threshold, enabled
       )
       VALUES ($1, COALESCE($2, ''), $3, $4, COALESCE($5, 'ABOVE'), COALESCE($6, 'avg'),
               COALESCE($7, 60), COALESCE($8, 0), $9, $10, COALESCE($11, TRUE))
       RETURNING id`,
      [
        input.name,
        input.description ?? null,
        input.serviceId,
        input.metricId,
        input.comparison ?? null,
        input.aggregation ?? null,
        input.windowSeconds ?? null,
        input.forSeconds ?? null,
        input.warningThreshold ?? null,
        input.criticalThreshold ?? null,
        input.enabled ?? null,
      ],
    );

    const created = await this.findById((result.rows[0] as { id: number }).id);
    return created as AlertRule;
  }

  async update(
    id: number,
    patch: UpdateAlertRuleInput & { serviceId?: number | null },
  ): Promise<AlertRule | null> {
    const result = await this.db.query<{ id: number }>(
      `UPDATE alert_rules SET
         name               = COALESCE($2, name),
         description        = COALESCE($3, description),
         service_id         = CASE WHEN $4::boolean THEN $5::bigint ELSE service_id END,
         comparison         = COALESCE($6, comparison),
         aggregation        = COALESCE($7, aggregation),
         window_seconds     = COALESCE($8, window_seconds),
         for_seconds        = COALESCE($9, for_seconds),
         warning_threshold  = CASE WHEN $10::boolean THEN $11::double precision
                                   ELSE warning_threshold END,
         critical_threshold = CASE WHEN $12::boolean THEN $13::double precision
                                   ELSE critical_threshold END,
         enabled            = COALESCE($14, enabled)
       WHERE id = $1
       RETURNING id`,
      [
        id,
        patch.name ?? null,
        patch.description ?? null,
        patch.serviceSlug !== undefined,
        patch.serviceId ?? null,
        patch.comparison ?? null,
        patch.aggregation ?? null,
        patch.windowSeconds ?? null,
        patch.forSeconds ?? null,
        patch.warningThreshold !== undefined,
        patch.warningThreshold ?? null,
        patch.criticalThreshold !== undefined,
        patch.criticalThreshold ?? null,
        patch.enabled ?? null,
      ],
    );

    return result.rows[0] === undefined ? null : this.findById(id);
  }

  async remove(id: number): Promise<boolean> {
    const result = await this.db.query('DELETE FROM alert_rules WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}

export const alertRuleRepository = new AlertRuleRepository();
