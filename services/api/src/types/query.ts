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

export interface AggregateRequest extends HistoryRequest {
  stepSeconds: number;
}

export interface HistoryRow {
  metricId: number;
  recordedAt: string;
  value: number;
}

export interface AggregatedRow {
  metricId: number;
  bucketStart: string;
  average: number;
  minimum: number;
  maximum: number;
  samples: number;
}
