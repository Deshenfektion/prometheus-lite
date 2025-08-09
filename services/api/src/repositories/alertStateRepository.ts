import type { Queryable } from '../db/queryable.js';
import { pool } from '../db/pool.js';
import type { ActiveAlert, AlertState, AlertStateRecord } from '../types/alerts.js';

interface AlertStateRow {
  rule_id: number;
  service_id: number;
  state: AlertState;
  since: Date;
  pending_state: AlertState | null;
  pending_since: Date | null;
  last_value: number | null;
  last_evaluated_at: Date;
}

function toRecord(row: AlertStateRow): AlertStateRecord {
  return {
    ruleId: row.rule_id,
    serviceId: row.service_id,
    state: row.state,
    since: row.since.toISOString(),
    pendingState: row.pending_state,
    pendingSince: row.pending_since === null ? null : row.pending_since.toISOString(),
    lastValue: row.last_value,
    lastEvaluatedAt: row.last_evaluated_at.toISOString(),
  };
}

export function stateKey(ruleId: number, serviceId: number): string {
  return `${ruleId}:${serviceId}`;
}

export interface StateWrite {
  ruleId: number;
  serviceId: number;
  state: AlertState;
  since: Date;
  pendingState: AlertState | null;
  pendingSince: Date | null;
  lastValue: number;
  evaluatedAt: Date;
}

export class AlertStateRepository {
  private readonly db: Queryable;

  constructor(db: Queryable = pool) {
    this.db = db;
  }

  async loadAll(): Promise<Map<string, AlertStateRecord>> {
    const result = await this.db.query<AlertStateRow>(
      `SELECT rule_id, service_id, state, since, pending_state, pending_since,
              last_value, last_evaluated_at
         FROM alert_states`,
    );

    return new Map(
      result.rows.map((row) => [stateKey(row.rule_id, row.service_id), toRecord(row)]),
    );
  }

  async upsert(write: StateWrite): Promise<void> {
    await this.db.query(
      `INSERT INTO alert_states (
         rule_id, service_id, state, since, pending_state, pending_since,
         last_value, last_evaluated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (rule_id, service_id) DO UPDATE SET
         state             = EXCLUDED.state,
         since             = EXCLUDED.since,
         pending_state     = EXCLUDED.pending_state,
         pending_since     = EXCLUDED.pending_since,
         last_value        = EXCLUDED.last_value,
         last_evaluated_at = EXCLUDED.last_evaluated_at`,
      [
        write.ruleId,
        write.serviceId,
        write.state,
        write.since,
        write.pendingState,
        write.pendingSince,
        write.lastValue,
        write.evaluatedAt,
      ],
    );
  }

  async listActive(): Promise<ActiveAlert[]> {
    const result = await this.db.query<{
      rule_id: number;
      rule_name: string;
      service_id: number;
      service_slug: string;
      metric_key: string;
      state: Exclude<AlertState, 'OK'>;
      last_value: number;
      since: Date;
      message: string | null;
      warning_threshold: number | null;
      critical_threshold: number | null;
    }>(
      `SELECT s.rule_id, r.name AS rule_name, s.service_id, sv.slug AS service_slug,
              m.key AS metric_key, s.state, s.last_value, s.since,
              e.message, r.warning_threshold, r.critical_threshold
         FROM alert_states s
         JOIN alert_rules r ON r.id = s.rule_id
         JOIN services sv ON sv.id = s.service_id
         JOIN metrics m ON m.id = r.metric_id
         LEFT JOIN alert_events e
           ON e.rule_id = s.rule_id
          AND e.service_id = s.service_id
          AND e.resolved_at IS NULL
          AND e.to_state <> 'OK'
        WHERE s.state <> 'OK'
        ORDER BY CASE s.state WHEN 'CRITICAL' THEN 0 ELSE 1 END, s.since ASC`,
    );

    return result.rows.map((row) => ({
      ruleId: row.rule_id,
      ruleName: row.rule_name,
      serviceId: row.service_id,
      serviceSlug: row.service_slug,
      metricKey: row.metric_key,
      state: row.state,
      value: row.last_value,
      threshold: row.state === 'CRITICAL' ? row.critical_threshold : row.warning_threshold,
      since: row.since.toISOString(),
      message: row.message ?? `${row.metric_key} is in ${row.state}`,
    }));
  }
}

export const alertStateRepository = new AlertStateRepository();
