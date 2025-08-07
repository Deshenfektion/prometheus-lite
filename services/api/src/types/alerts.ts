export type AlertState = 'OK' | 'WARNING' | 'CRITICAL';
export type Comparison = 'ABOVE' | 'BELOW';
export type Aggregation = 'avg' | 'max' | 'min' | 'last';

export interface AlertRule {
  id: number;
  name: string;
  description: string;
  serviceId: number | null;
  metricId: number;
  metricKey: string;
  comparison: Comparison;
  aggregation: Aggregation;
  windowSeconds: number;
  forSeconds: number;
  warningThreshold: number | null;
  criticalThreshold: number | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlertRuleInput {
  name: string;
  description?: string;
  serviceSlug?: string | null;
  metricKey: string;
  comparison?: Comparison;
  aggregation?: Aggregation;
  windowSeconds?: number;
  forSeconds?: number;
  warningThreshold?: number | null;
  criticalThreshold?: number | null;
  enabled?: boolean;
}

export type UpdateAlertRuleInput = Partial<Omit<CreateAlertRuleInput, 'metricKey'>>;

export interface AlertStateRecord {
  ruleId: number;
  serviceId: number;
  state: AlertState;
  since: string;
  pendingState: AlertState | null;
  pendingSince: string | null;
  lastValue: number | null;
  lastEvaluatedAt: string;
}

export interface AlertEvent {
  id: number;
  ruleId: number;
  ruleName: string;
  serviceId: number;
  serviceSlug: string;
  metricKey: string;
  fromState: AlertState;
  toState: AlertState;
  value: number;
  threshold: number | null;
  message: string;
  occurredAt: string;
  resolvedAt: string | null;
}

export interface ActiveAlert {
  ruleId: number;
  ruleName: string;
  serviceId: number;
  serviceSlug: string;
  metricKey: string;
  state: Exclude<AlertState, 'OK'>;
  value: number;
  threshold: number | null;
  since: string;
  message: string;
}

export interface EvaluationSummary {
  evaluatedAt: string;
  rulesEvaluated: number;
  pairsEvaluated: number;
  transitions: number;
  durationMs: number;
}
