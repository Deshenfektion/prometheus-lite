import type { LatestSnapshot } from '../api/types.ts';

export type HealthStatus = 'OK' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';

export const MIN_STALE_AFTER_SECONDS = 60;
export const STALE_INTERVAL_MULTIPLIER = 6;

export function staleAfterSeconds(pollIntervalSeconds: number): number {
  return Math.max(pollIntervalSeconds * STALE_INTERVAL_MULTIPLIER, MIN_STALE_AFTER_SECONDS);
}

export interface ServiceHealth {
  status: HealthStatus;
  reasons: string[];
  lastSeen: string | undefined;
}

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

const SEVERITY_ORDER: Record<HealthStatus, number> = {
  UNKNOWN: 0,
  OK: 1,
  WARNING: 2,
  CRITICAL: 3,
};

export function worstStatus(a: HealthStatus, b: HealthStatus): HealthStatus {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b;
}

export function readValue(snapshot: LatestSnapshot | undefined, key: string): number | undefined {
  return snapshot?.metrics[key]?.value;
}

function newestTimestamp(snapshot: LatestSnapshot | undefined): string | undefined {
  if (snapshot === undefined) {
    return undefined;
  }

  let newest: string | undefined;
  for (const reading of Object.values(snapshot.metrics)) {
    if (reading === undefined) {
      continue;
    }
    if (newest === undefined || reading.recordedAt > newest) {
      newest = reading.recordedAt;
    }
  }
  return newest;
}

export interface HealthOptions {
  thresholds?: HealthThresholds;
  staleAfter?: number;
  now?: number;
}

export function deriveHealth(
  snapshot: LatestSnapshot | undefined,
  options: HealthOptions = {},
): ServiceHealth {
  const thresholds = options.thresholds ?? DEFAULT_THRESHOLDS;
  const now = options.now ?? Date.now();
  const staleAfter = options.staleAfter ?? MIN_STALE_AFTER_SECONDS;
  const lastSeen = newestTimestamp(snapshot);

  if (snapshot === undefined || lastSeen === undefined) {
    return { status: 'UNKNOWN', reasons: ['no data collected yet'], lastSeen: undefined };
  }

  const ageSeconds = (now - new Date(lastSeen).getTime()) / 1000;
  if (ageSeconds > staleAfter) {
    return { status: 'UNKNOWN', reasons: ['no recent snapshots'], lastSeen };
  }

  const reasons: string[] = [];
  let status: HealthStatus = 'OK';

  const availability = readValue(snapshot, 'availability');
  if (availability === 0) {
    return { status: 'CRITICAL', reasons: ['service is unreachable'], lastSeen };
  }

  const latency = readValue(snapshot, 'latency_p95_ms') ?? readValue(snapshot, 'latency_ms');
  if (latency !== undefined) {
    if (latency >= thresholds.latencyCriticalMs) {
      status = worstStatus(status, 'CRITICAL');
      reasons.push(`p95 latency ${Math.round(latency)} ms`);
    } else if (latency >= thresholds.latencyWarningMs) {
      status = worstStatus(status, 'WARNING');
      reasons.push(`p95 latency ${Math.round(latency)} ms`);
    }
  }

  const errorRate = readValue(snapshot, 'error_rate');
  if (errorRate !== undefined) {
    if (errorRate >= thresholds.errorRateCritical) {
      status = worstStatus(status, 'CRITICAL');
      reasons.push(`error rate ${(errorRate * 100).toFixed(1)}%`);
    } else if (errorRate >= thresholds.errorRateWarning) {
      status = worstStatus(status, 'WARNING');
      reasons.push(`error rate ${(errorRate * 100).toFixed(1)}%`);
    }
  }

  for (const [key, label] of [
    ['cpu_percent', 'CPU'],
    ['memory_percent', 'memory'],
  ] as const) {
    const value = readValue(snapshot, key);
    if (value === undefined) {
      continue;
    }
    if (value >= thresholds.resourceCriticalPercent) {
      status = worstStatus(status, 'CRITICAL');
      reasons.push(`${label} ${value.toFixed(0)}%`);
    } else if (value >= thresholds.resourceWarningPercent) {
      status = worstStatus(status, 'WARNING');
      reasons.push(`${label} ${value.toFixed(0)}%`);
    }
  }

  return { status, reasons, lastSeen };
}
