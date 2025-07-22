import { request } from './client.ts';
import type {
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
