export type MetricKind = 'gauge' | 'counter' | 'ratio';

export interface MetricDefinition {
  id: number;
  key: string;
  displayName: string;
  unit: string;
  kind: MetricKind;
  description: string;
}

export interface MetricPoint {
  serviceId: number;
  metricId: number;
  recordedAt: Date;
  value: number;
}

export interface IngestSnapshot {
  service: string;
  recordedAt: string;
  metrics: Record<string, number>;
}

export interface IngestBatch {
  collector: string;
  snapshots: IngestSnapshot[];
}

export interface RejectedSnapshot {
  index: number;
  service: string;
  reason: string;
}

export interface IngestOutcome {
  acceptedSnapshots: number;
  acceptedPoints: number;
  storedPoints: number;
  rejected: RejectedSnapshot[];
}
