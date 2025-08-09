import { describe, expect, it } from 'vitest';
import { breaches, describeBreach, evaluateThreshold } from '../../services/alertEvaluator.js';
import type { AlertRule } from '../../types/alerts.js';

function rule(overrides: Partial<AlertRule> = {}): AlertRule {
  return {
    id: 1,
    name: 'High p95 latency',
    description: '',
    serviceId: null,
    metricId: 5,
    metricKey: 'latency_p95_ms',
    comparison: 'ABOVE',
    aggregation: 'avg',
    windowSeconds: 300,
    forSeconds: 0,
    warningThreshold: 500,
    criticalThreshold: 1500,
    enabled: true,
    createdAt: '2025-04-08T10:00:00.000Z',
    updatedAt: '2025-04-08T10:00:00.000Z',
    ...overrides,
  };
}

describe('breaches', () => {
  it('treats thresholds as inclusive in both directions', () => {
    expect(breaches(500, 500, 'ABOVE')).toBe(true);
    expect(breaches(499.9, 500, 'ABOVE')).toBe(false);
    expect(breaches(0.5, 0.5, 'BELOW')).toBe(true);
    expect(breaches(0.51, 0.5, 'BELOW')).toBe(false);
  });
});

describe('evaluateThreshold', () => {
  it('stays OK below the warning threshold', () => {
    expect(evaluateThreshold(rule(), 120)).toEqual({ state: 'OK', threshold: null });
  });

  it('warns between the warning and critical thresholds', () => {
    expect(evaluateThreshold(rule(), 700)).toEqual({ state: 'WARNING', threshold: 500 });
  });

  it('prefers critical when both thresholds are breached', () => {
    expect(evaluateThreshold(rule(), 4000)).toEqual({ state: 'CRITICAL', threshold: 1500 });
  });

  it('handles a rule with only a critical threshold', () => {
    const criticalOnly = rule({ warningThreshold: null });
    expect(evaluateThreshold(criticalOnly, 700).state).toBe('OK');
    expect(evaluateThreshold(criticalOnly, 1600).state).toBe('CRITICAL');
  });

  it('handles a rule with only a warning threshold', () => {
    const warningOnly = rule({ criticalThreshold: null });
    expect(evaluateThreshold(warningOnly, 9000).state).toBe('WARNING');
  });

  it('inverts the comparison for BELOW rules', () => {
    const availability = rule({
      metricKey: 'availability',
      comparison: 'BELOW',
      warningThreshold: 0.99,
      criticalThreshold: 0.5,
    });

    expect(evaluateThreshold(availability, 1).state).toBe('OK');
    expect(evaluateThreshold(availability, 0.95).state).toBe('WARNING');
    expect(evaluateThreshold(availability, 0.2).state).toBe('CRITICAL');
  });

  it('does not fire on a fully available service', () => {
    const availability = rule({
      metricKey: 'availability',
      comparison: 'BELOW',
      warningThreshold: 0.99,
      criticalThreshold: 0.5,
    });

    expect(evaluateThreshold(availability, 1).state).toBe('OK');
  });
});

describe('describeBreach', () => {
  it('names the metric, value, direction and threshold', () => {
    const message = describeBreach(rule(), { state: 'WARNING', threshold: 500 }, 712.4);
    expect(message).toBe(
      'latency_p95_ms 712 is above the warning threshold of 500 (avg over 300s)',
    );
  });

  it('describes a BELOW breach as below', () => {
    const availability = rule({
      metricKey: 'availability',
      comparison: 'BELOW',
      windowSeconds: 60,
    });
    const message = describeBreach(availability, { state: 'CRITICAL', threshold: 0.5 }, 0.25);
    expect(message).toContain('is below the critical threshold of 0.5');
  });

  it('describes a recovery', () => {
    expect(describeBreach(rule(), { state: 'OK', threshold: null }, 91.2)).toBe(
      'latency_p95_ms recovered to 91.200',
    );
  });
});
