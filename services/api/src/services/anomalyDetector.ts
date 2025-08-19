import { mean, median, modifiedZScore, standardDeviation, zScore } from '../lib/statistics.js';
import type { SeriesPoint } from '../types/query.js';

export type ScoringMethod = 'zscore' | 'modified-zscore';

export interface AnomalyOptions {
  windowSize: number;
  threshold: number;
  method: ScoringMethod;
  minSpread: number;
}

export const DEFAULT_ANOMALY_OPTIONS: AnomalyOptions = {
  windowSize: 30,
  threshold: 3.5,
  method: 'modified-zscore',
  minSpread: 1e-6,
};

export interface Anomaly {
  recordedAt: string;
  value: number;
  score: number;
  baseline: number;
  direction: 'above' | 'below';
}

function spread(window: readonly number[], method: ScoringMethod): number {
  return method === 'zscore' ? standardDeviation(window) : medianSpread(window);
}

function medianSpread(window: readonly number[]): number {
  const centre = median(window);
  const deviations = window.map((value) => Math.abs(value - centre));
  return median(deviations);
}

function baselineOf(window: readonly number[], method: ScoringMethod): number {
  return method === 'zscore' ? mean(window) : median(window);
}

function scoreOf(value: number, window: readonly number[], method: ScoringMethod): number {
  return method === 'zscore' ? zScore(value, window) : modifiedZScore(value, window);
}

export function detectAnomalies(
  points: readonly SeriesPoint[],
  overrides: Partial<AnomalyOptions> = {},
): Anomaly[] {
  const options = { ...DEFAULT_ANOMALY_OPTIONS, ...overrides };
  const anomalies: Anomaly[] = [];

  if (points.length <= options.windowSize) {
    return anomalies;
  }

  const values = points.map((point) => point.value);

  for (let index = options.windowSize; index < points.length; index += 1) {
    const window = values.slice(index - options.windowSize, index);
    if (spread(window, options.method) <= options.minSpread) {
      continue;
    }

    const point = points[index] as SeriesPoint;
    const score = scoreOf(point.value, window, options.method);

    if (Math.abs(score) < options.threshold) {
      continue;
    }

    anomalies.push({
      recordedAt: point.recordedAt,
      value: point.value,
      score: Number(score.toFixed(3)),
      baseline: Number(baselineOf(window, options.method).toFixed(3)),
      direction: score > 0 ? 'above' : 'below',
    });
  }

  return anomalies;
}
