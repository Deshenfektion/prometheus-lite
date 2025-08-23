import type { HealthStatus } from '../api/types.ts';

export interface HealthThresholds {
  latencyWarningMs: number;
  latencyCriticalMs: number;
  errorRateWarning: number;
  errorRateCritical: number;
  resourceWarningPercent: number;
  resourceCriticalPercent: number;
}

export const DEFAULT_THRESHOLDS: HealthThresholds = {
  latencyWarningMs: 500,
  latencyCriticalMs: 1500,
  errorRateWarning: 0.05,
  errorRateCritical: 0.25,
  resourceWarningPercent: 80,
  resourceCriticalPercent: 92,
};

const SEVERITY: Record<HealthStatus, number> = {
  UNKNOWN: 0,
  OK: 1,
  WARNING: 2,
  CRITICAL: 3,
};

export function worstStatus(a: HealthStatus, b: HealthStatus): HealthStatus {
  return SEVERITY[a] >= SEVERITY[b] ? a : b;
}

export type { HealthStatus };
