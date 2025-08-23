export interface ApiEnvelope<T> {
  data: T;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface Service {
  id: number;
  slug: string;
  displayName: string;
  baseUrl: string;
  healthPath: string;
  environment: string;
  pollIntervalSeconds: number;
  timeoutMs: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MetricDefinition {
  id: number;
  key: string;
  displayName: string;
  unit: string;
  kind: 'gauge' | 'counter' | 'ratio';
  description: string;
}

export interface LatestReading {
  value: number;
  recordedAt: string;
}

export interface LatestSnapshot {
  service: string;
  metrics: Record<string, LatestReading | undefined>;
}

export interface SeriesPoint {
  recordedAt: string;
  value: number;
  min?: number;
  max?: number;
  samples?: number;
}

export interface MetricSeries {
  service: string;
  metric: string;
  unit: string;
  stepSeconds: number | null;
  points: SeriesPoint[];
}

export interface Anomaly {
  recordedAt: string;
  value: number;
  score: number;
  baseline: number;
  direction: 'above' | 'below';
}

export interface AnnotatedSeries extends MetricSeries {
  anomalies: Anomaly[];
}

export type AlertState = 'OK' | 'WARNING' | 'CRITICAL';

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

export interface AlertRule {
  id: number;
  name: string;
  description: string;
  serviceId: number | null;
  metricId: number;
  metricKey: string;
  comparison: 'ABOVE' | 'BELOW';
  aggregation: 'avg' | 'max' | 'min' | 'last';
  windowSeconds: number;
  forSeconds: number;
  warningThreshold: number | null;
  criticalThreshold: number | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type HealthStatus = AlertState | 'UNKNOWN';

export interface DashboardReading {
  value: number;
  recordedAt: string;
}

export interface DashboardService {
  slug: string;
  displayName: string;
  environment: string;
  enabled: boolean;
  pollIntervalSeconds: number;
  status: HealthStatus;
  reasons: string[];
  lastSeen: string | null;
  metrics: Record<string, DashboardReading | undefined>;
}

export interface DashboardTotals {
  services: number;
  ok: number;
  warning: number;
  critical: number;
  unknown: number;
  activeAlerts: number;
  criticalAlerts: number;
}

export interface DashboardSummary {
  generatedAt: string;
  totals: DashboardTotals;
  services: DashboardService[];
  alerts: ActiveAlert[];
}

export type Role = 'USER' | 'ADMIN';

export interface CurrentUser {
  id: number;
  email: string;
  displayName: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface LoginResponse {
  token: string;
  expiresIn: number;
  expiresAt: string;
  user: CurrentUser;
}
