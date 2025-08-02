import { describe, expect, it } from 'vitest';
import { STALE_AFTER_SECONDS, deriveHealth, worstStatus } from '../lib/status.ts';
import type { LatestSnapshot } from '../api/types.ts';

const NOW = new Date('2025-03-29T12:00:00.000Z').getTime();
const RECENT = new Date(NOW - 5_000).toISOString();

function snapshot(metrics: Record<string, number>, recordedAt = RECENT): LatestSnapshot {
  return {
    service: 'checkout-api',
    metrics: Object.fromEntries(
      Object.entries(metrics).map(([key, value]) => [key, { value, recordedAt }]),
    ),
  };
}

describe('deriveHealth', () => {
  it('reports UNKNOWN when nothing has been collected', () => {
    const health = deriveHealth(undefined, undefined, NOW);
    expect(health.status).toBe('UNKNOWN');
    expect(health.lastSeen).toBeUndefined();
  });

  it('reports UNKNOWN when the newest snapshot is stale', () => {
    const stale = new Date(NOW - (STALE_AFTER_SECONDS + 30) * 1000).toISOString();
    const health = deriveHealth(snapshot({ availability: 1 }, stale), undefined, NOW);

    expect(health.status).toBe('UNKNOWN');
    expect(health.reasons).toContain('no recent snapshots');
  });

  it('reports OK for a healthy service', () => {
    const health = deriveHealth(
      snapshot({ availability: 1, latency_p95_ms: 120, error_rate: 0, cpu_percent: 20 }),
      undefined,
      NOW,
    );

    expect(health.status).toBe('OK');
    expect(health.reasons).toEqual([]);
  });

  it('treats an unreachable service as CRITICAL regardless of other metrics', () => {
    const health = deriveHealth(
      snapshot({ availability: 0, latency_p95_ms: 10, cpu_percent: 1 }),
      undefined,
      NOW,
    );

    expect(health.status).toBe('CRITICAL');
    expect(health.reasons).toEqual(['service is unreachable']);
  });

  it('warns on elevated latency and escalates past the critical threshold', () => {
    const warning = deriveHealth(
      snapshot({ availability: 1, latency_p95_ms: 800 }),
      undefined,
      NOW,
    );
    const critical = deriveHealth(
      snapshot({ availability: 1, latency_p95_ms: 2000 }),
      undefined,
      NOW,
    );

    expect(warning.status).toBe('WARNING');
    expect(critical.status).toBe('CRITICAL');
  });

  it('falls back to raw latency when no percentile is available', () => {
    const health = deriveHealth(snapshot({ availability: 1, latency_ms: 900 }), undefined, NOW);
    expect(health.status).toBe('WARNING');
  });

  it('escalates on error rate and resource pressure', () => {
    expect(
      deriveHealth(snapshot({ availability: 1, error_rate: 0.1 }), undefined, NOW).status,
    ).toBe('WARNING');
    expect(
      deriveHealth(snapshot({ availability: 1, error_rate: 0.4 }), undefined, NOW).status,
    ).toBe('CRITICAL');
    expect(
      deriveHealth(snapshot({ availability: 1, memory_percent: 95 }), undefined, NOW).status,
    ).toBe('CRITICAL');
  });

  it('keeps the worst status when several signals disagree', () => {
    const health = deriveHealth(
      snapshot({ availability: 1, latency_p95_ms: 600, error_rate: 0.4 }),
      undefined,
      NOW,
    );

    expect(health.status).toBe('CRITICAL');
    expect(health.reasons).toHaveLength(2);
  });

  it('respects custom thresholds', () => {
    const lenient = deriveHealth(
      snapshot({ availability: 1, latency_p95_ms: 800 }),
      {
        latencyWarningMs: 1000,
        latencyCriticalMs: 5000,
        errorRateWarning: 0.5,
        errorRateCritical: 0.9,
        resourceWarningPercent: 95,
        resourceCriticalPercent: 99,
      },
      NOW,
    );

    expect(lenient.status).toBe('OK');
  });
});

describe('worstStatus', () => {
  it('ranks CRITICAL above WARNING above OK above UNKNOWN', () => {
    expect(worstStatus('OK', 'WARNING')).toBe('WARNING');
    expect(worstStatus('CRITICAL', 'WARNING')).toBe('CRITICAL');
    expect(worstStatus('UNKNOWN', 'OK')).toBe('OK');
  });
});
