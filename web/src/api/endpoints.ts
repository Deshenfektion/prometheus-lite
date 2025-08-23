import { request } from './client.ts';
import type {
  ActiveAlert,
  DashboardSummary,
  AnnotatedSeries,
  AlertEvent,
  AlertRule,
  CurrentUser,
  LatestSnapshot,
  LoginResponse,
  MetricDefinition,
  MetricSeries,
  Service,
} from './types.ts';

export function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export function fetchCurrentUser(): Promise<CurrentUser> {
  return request<CurrentUser>('/auth/me');
}

export function fetchServices(environment?: string): Promise<Service[]> {
  return request<Service[]>('/services', {
    ...(environment === undefined ? {} : { query: { environment } }),
  });
}

export function fetchMetricDefinitions(): Promise<MetricDefinition[]> {
  return request<MetricDefinition[]>('/metrics');
}

export function fetchLatestMetrics(): Promise<LatestSnapshot[]> {
  return request<LatestSnapshot[]>('/metrics/latest');
}

export interface HistoryParams {
  service: string;
  metrics?: string[];
  from?: string;
  to?: string;
  step?: number;
}

export function fetchMetricHistory(params: HistoryParams): Promise<MetricSeries[]> {
  return request<MetricSeries[]>('/metrics/history', {
    query: {
      service: params.service,
      ...(params.metrics === undefined ? {} : { metrics: params.metrics.join(',') }),
      ...(params.from === undefined ? {} : { from: params.from }),
      ...(params.to === undefined ? {} : { to: params.to }),
      ...(params.step === undefined ? {} : { step: params.step }),
    },
  });
}

export interface AnomalyParams extends HistoryParams {
  window?: number;
  threshold?: number;
}

export function fetchMetricAnomalies(params: AnomalyParams): Promise<AnnotatedSeries[]> {
  return request<AnnotatedSeries[]>('/metrics/anomalies', {
    query: {
      service: params.service,
      ...(params.metrics === undefined ? {} : { metrics: params.metrics.join(',') }),
      ...(params.from === undefined ? {} : { from: params.from }),
      ...(params.to === undefined ? {} : { to: params.to }),
      ...(params.window === undefined ? {} : { window: params.window }),
      ...(params.threshold === undefined ? {} : { threshold: params.threshold }),
    },
  });
}

export function fetchDashboard(): Promise<DashboardSummary> {
  return request<DashboardSummary>('/dashboard');
}

export function fetchActiveAlerts(): Promise<ActiveAlert[]> {
  return request<ActiveAlert[]>('/alerts');
}

export interface AlertEventParams {
  service?: string;
  state?: string;
  limit?: number;
}

export function fetchAlertEvents(params: AlertEventParams = {}): Promise<AlertEvent[]> {
  return request<AlertEvent[]>('/alerts/events', {
    query: {
      ...(params.service === undefined ? {} : { service: params.service }),
      ...(params.state === undefined ? {} : { state: params.state }),
      limit: params.limit ?? 50,
    },
  });
}

export function fetchAlertRules(): Promise<AlertRule[]> {
  return request<AlertRule[]>('/alerts/rules');
}
