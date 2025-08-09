import type { Queryable } from '../db/queryable.js';
import { pool } from '../db/pool.js';
import type { AlertEvent, AlertState } from '../types/alerts.js';

interface AlertEventRow {
  id: number;
  rule_id: number;
  rule_name: string;
  service_id: number;
  service_slug: string;
  metric_key: string;
  from_state: AlertState;
  to_state: AlertState;
  value: number;
  threshold: number | null;
  message: string;
  occurred_at: Date;
  resolved_at: Date | null;
}

const SELECT_EVENT = `
  SELECT e.id, e.rule_id, r.name AS rule_name, e.service_id, sv.slug AS service_slug,
         m.key AS metric_key, e.from_state, e.to_state, e.value, e.threshold,
         e.message, e.occurred_at, e.resolved_at
    FROM alert_events e
    JOIN alert_rules r ON r.id = e.rule_id
    JOIN services sv ON sv.id = e.service_id
    JOIN metrics m ON m.id = r.metric_id
`;

function toEvent(row: AlertEventRow): AlertEvent {
  return {
    id: row.id,
    ruleId: row.rule_id,
    ruleName: row.rule_name,
    serviceId: row.service_id,
    serviceSlug: row.service_slug,
    metricKey: row.metric_key,
    fromState: row.from_state,
    toState: row.to_state,
    value: row.value,
    threshold: row.threshold,
    message: row.message,
    occurredAt: row.occurred_at.toISOString(),
    resolvedAt: row.resolved_at === null ? null : row.resolved_at.toISOString(),
  };
}

export interface EventFilter {
  serviceSlug?: string;
  state?: AlertState;
  since?: Date;
  limit?: number;
}

export interface EventWrite {
  ruleId: number;
  serviceId: number;
  fromState: AlertState;
  toState: AlertState;
  value: number;
  threshold: number | null;
  message: string;
  occurredAt: Date;
  resolvedAt?: Date | null;
}

export class AlertEventRepository {
  private readonly db: Queryable;

  constructor(db: Queryable = pool) {
    this.db = db;
  }

  async insert(event: EventWrite): Promise<number> {
    const result = await this.db.query<{ id: number }>(
      `INSERT INTO alert_events (
         rule_id, service_id, from_state, to_state, value, threshold,
         message, occurred_at, resolved_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        event.ruleId,
        event.serviceId,
        event.fromState,
        event.toState,
        event.value,
        event.threshold,
        event.message,
        event.occurredAt,
        event.resolvedAt ?? null,
      ],
    );
    return (result.rows[0] as { id: number }).id;
  }

  async resolveOpen(ruleId: number, serviceId: number, at: Date): Promise<number> {
    const result = await this.db.query(
      `UPDATE alert_events
          SET resolved_at = $3
        WHERE rule_id = $1
          AND service_id = $2
          AND resolved_at IS NULL
          AND to_state <> 'OK'`,
      [ruleId, serviceId, at],
    );
    return result.rowCount ?? 0;
  }

  async list(filter: EventFilter = {}): Promise<AlertEvent[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.serviceSlug !== undefined) {
      params.push(filter.serviceSlug);
      conditions.push(`sv.slug = $${params.length}`);
    }
    if (filter.state !== undefined) {
      params.push(filter.state);
      conditions.push(`e.to_state = $${params.length}`);
    }
    if (filter.since !== undefined) {
      params.push(filter.since);
      conditions.push(`e.occurred_at >= $${params.length}`);
    }

    params.push(Math.min(filter.limit ?? 100, 500));
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.db.query<AlertEventRow>(
      `${SELECT_EVENT} ${where} ORDER BY e.occurred_at DESC LIMIT $${params.length}`,
      params,
    );

    return result.rows.map(toEvent);
  }
}

export const alertEventRepository = new AlertEventRepository();
