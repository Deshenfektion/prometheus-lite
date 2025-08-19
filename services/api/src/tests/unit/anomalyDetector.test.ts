import { describe, expect, it } from 'vitest';
import { detectAnomalies } from '../../services/anomalyDetector.js';
import type { SeriesPoint } from '../../types/query.js';

const START = new Date('2025-04-27T10:00:00.000Z').getTime();

function series(values: number[]): SeriesPoint[] {
  return values.map((value, index) => ({
    recordedAt: new Date(START + index * 10_000).toISOString(),
    value,
  }));
}

function steady(count: number, base = 50): number[] {
  return Array.from({ length: count }, (_, index) => base + (index % 5) - 2);
}

describe('detectAnomalies', () => {
  it('finds nothing in a steady series', () => {
    expect(detectAnomalies(series(steady(100)))).toEqual([]);
  });

  it('needs more points than the window before it reports anything', () => {
    const short = series([...steady(20), 5000]);
    expect(detectAnomalies(short, { windowSize: 30 })).toEqual([]);
  });

  it('flags a latency spike above the baseline', () => {
    const points = series([...steady(60), 5000, ...steady(10)]);
    const anomalies = detectAnomalies(points, { windowSize: 30 });

    expect(anomalies.length).toBeGreaterThanOrEqual(1);
    expect(anomalies[0]).toMatchObject({ value: 5000, direction: 'above' });
    expect(anomalies[0]?.score).toBeGreaterThan(3.5);
  });

  it('records the baseline the spike was measured against', () => {
    const points = series([...steady(60), 5000]);
    const anomalies = detectAnomalies(points, { windowSize: 30 });

    expect(anomalies[0]?.baseline).toBeGreaterThan(45);
    expect(anomalies[0]?.baseline).toBeLessThan(55);
  });

  it('flags a collapse below the baseline', () => {
    const points = series([...steady(60, 200), 1]);
    const anomalies = detectAnomalies(points, { windowSize: 30 });

    expect(anomalies[0]).toMatchObject({ value: 1, direction: 'below' });
  });

  it('ignores a flat series where every value is identical', () => {
    const points = series([...Array.from({ length: 60 }, () => 50), 51]);
    expect(detectAnomalies(points, { windowSize: 30 })).toEqual([]);
  });

  it('respects a stricter threshold', () => {
    const points = series([...steady(60), 120]);

    expect(detectAnomalies(points, { windowSize: 30, threshold: 3 }).length).toBeGreaterThan(0);
    expect(detectAnomalies(points, { windowSize: 30, threshold: 100 })).toEqual([]);
  });

  it('does not let one spike hide the next when using the robust score', () => {
    const points = series([...steady(40), 4000, ...steady(5), 4200]);
    const anomalies = detectAnomalies(points, { windowSize: 30, method: 'modified-zscore' });

    expect(anomalies.map((anomaly) => anomaly.value)).toContain(4000);
    expect(anomalies.map((anomaly) => anomaly.value)).toContain(4200);
  });

  it('keeps the robust score sensitive after a spike enters the baseline', () => {
    const points = series([...steady(40), 4000, ...steady(5), 4200]);

    const robust = detectAnomalies(points, { windowSize: 30, method: 'modified-zscore' });
    const plain = detectAnomalies(points, { windowSize: 30, method: 'zscore' });

    const secondRobust = robust.find((anomaly) => anomaly.value === 4200);
    const secondPlain = plain.find((anomaly) => anomaly.value === 4200);

    expect(secondRobust).toBeDefined();
    expect(secondPlain).toBeDefined();
    expect(Math.abs(secondRobust?.score ?? 0)).toBeGreaterThan(
      Math.abs(secondPlain?.score ?? 0) * 100,
    );
  });

  it('lets one spike swallow the next when the plain z-score is pushed further', () => {
    const points = series([...steady(40), 6000, 6000, 6000, 6000, ...steady(3), 700]);

    const robust = detectAnomalies(points, { windowSize: 30, method: 'modified-zscore' });
    const plain = detectAnomalies(points, { windowSize: 30, method: 'zscore' });

    expect(robust.some((anomaly) => anomaly.value === 700)).toBe(true);
    expect(plain.some((anomaly) => anomaly.value === 700)).toBe(false);
  });

  it('scores every point after the warm-up window', () => {
    const points = series([...steady(35), 9000, 9000, 9000]);
    const anomalies = detectAnomalies(points, { windowSize: 30 });

    expect(anomalies.length).toBeGreaterThan(0);
    expect(new Set(anomalies.map((anomaly) => anomaly.recordedAt)).size).toBe(anomalies.length);
  });
});
