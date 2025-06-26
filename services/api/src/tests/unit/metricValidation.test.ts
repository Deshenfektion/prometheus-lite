import { describe, expect, it } from 'vitest';
import { validateMetricValue } from '../../services/metricValidation.js';
import type { MetricDefinition } from '../../types/metrics.js';

function definition(key: string, unit: string): MetricDefinition {
  return { id: 1, key, displayName: key, unit, kind: 'gauge', description: '' };
}

describe('validateMetricValue', () => {
  it('accepts values inside the unit bounds', () => {
    expect(validateMetricValue(definition('cpu_percent', 'percent'), 42)).toBeUndefined();
    expect(validateMetricValue(definition('latency_ms', 'milliseconds'), 0)).toBeUndefined();
    expect(validateMetricValue(definition('error_rate', 'ratio'), 1)).toBeUndefined();
  });

  it('restricts availability to zero or one', () => {
    const availability = definition('availability', 'boolean');
    expect(validateMetricValue(availability, 1)).toBeUndefined();
    expect(validateMetricValue(availability, 0.5)).toMatch(/must be one of/);
  });

  it('requires status codes to be whole numbers in range', () => {
    const status = definition('http_status', 'code');
    expect(validateMetricValue(status, 503)).toBeUndefined();
    expect(validateMetricValue(status, 200.5)).toMatch(/integer/);
    expect(validateMetricValue(status, 42)).toMatch(/between 100 and 599/);
  });

  it('rejects percentages outside zero to one hundred', () => {
    const memory = definition('memory_percent', 'percent');
    expect(validateMetricValue(memory, 145)).toMatch(/between 0 and 100/);
    expect(validateMetricValue(memory, -1)).toMatch(/between 0 and 100/);
  });

  it('rejects non-finite values regardless of unit', () => {
    expect(validateMetricValue(definition('custom', 'widgets'), Number.NaN)).toMatch(/finite/);
    expect(validateMetricValue(definition('custom', 'widgets'), Infinity)).toMatch(/finite/);
  });

  it('passes through units it does not know about', () => {
    expect(validateMetricValue(definition('custom', 'widgets'), 12_345)).toBeUndefined();
  });
});
