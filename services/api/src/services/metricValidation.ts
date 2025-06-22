import type { MetricDefinition } from '../types/metrics.js';

interface Bounds {
  min: number;
  max: number;
  integer?: boolean;
  discrete?: readonly number[];
}

const BOUNDS_BY_UNIT: Record<string, Bounds> = {
  boolean: { min: 0, max: 1, discrete: [0, 1] },
  percent: { min: 0, max: 100 },
  ratio: { min: 0, max: 1 },
  milliseconds: { min: 0, max: 600_000 },
  code: { min: 100, max: 599, integer: true },
  'requests/s': { min: 0, max: 1_000_000 },
};

export function validateMetricValue(
  definition: MetricDefinition,
  value: number,
): string | undefined {
  if (!Number.isFinite(value)) {
    return `${definition.key} must be a finite number`;
  }

  const bounds = BOUNDS_BY_UNIT[definition.unit];
  if (bounds === undefined) {
    return undefined;
  }

  if (bounds.discrete !== undefined && !bounds.discrete.includes(value)) {
    return `${definition.key} must be one of ${bounds.discrete.join(', ')}`;
  }

  if (bounds.integer === true && !Number.isInteger(value)) {
    return `${definition.key} must be an integer`;
  }

  if (value < bounds.min || value > bounds.max) {
    return `${definition.key} must be between ${bounds.min} and ${bounds.max}`;
  }

  return undefined;
}
