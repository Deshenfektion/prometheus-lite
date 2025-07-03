export interface SeriesPoint {
  recordedAt: string;
  value: number;
}

export interface MetricSeries {
  service: string;
  metric: string;
  unit: string;
  points: SeriesPoint[];
}

export interface LatestValue {
  serviceId: number;
  metricId: number;
  recordedAt: string;
  value: number;
}

export interface HistoryRequest {
  serviceId: number;
  metricIds: number[];
  from: Date;
  to: Date;
  limit: number;
}

export interface HistoryRow {
  metricId: number;
  recordedAt: string;
  value: number;
}
