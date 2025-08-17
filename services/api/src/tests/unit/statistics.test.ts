import { describe, expect, it } from 'vitest';
import {
  mean,
  median,
  medianAbsoluteDeviation,
  modifiedZScore,
  percentile,
  standardDeviation,
  variance,
  zScore,
} from '../../lib/statistics.js';

describe('central tendency', () => {
  it('computes the mean', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(mean([])).toBeNaN();
  });

  it('computes the median for odd and even counts', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('is unaffected by input ordering', () => {
    expect(median([9, 1, 5, 3, 7])).toBe(median([1, 3, 5, 7, 9]));
  });
});

describe('spread', () => {
  it('uses the sample variance', () => {
    expect(variance([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(4.571, 3);
    expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
  });

  it('reports zero spread for a constant series', () => {
    expect(standardDeviation([5, 5, 5, 5])).toBe(0);
    expect(medianAbsoluteDeviation([5, 5, 5, 5])).toBe(0);
  });

  it('computes the median absolute deviation', () => {
    expect(medianAbsoluteDeviation([1, 2, 3, 4, 5])).toBe(1);
  });

  it('needs at least two samples for a variance', () => {
    expect(variance([42])).toBe(0);
  });
});

describe('percentile', () => {
  it('uses nearest rank', () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(values, 0.5)).toBe(50);
    expect(percentile(values, 0.95)).toBe(100);
  });
});

describe('scores', () => {
  const baseline = [50, 52, 48, 51, 49, 50, 51, 49];

  it('scores a value inside the baseline near zero', () => {
    expect(Math.abs(zScore(50, baseline))).toBeLessThan(1);
  });

  it('scores a clear spike highly', () => {
    expect(zScore(500, baseline)).toBeGreaterThan(3);
  });

  it('returns zero when the baseline has no spread', () => {
    expect(zScore(90, [10, 10, 10])).toBe(0);
    expect(modifiedZScore(90, [10, 10, 10])).toBe(0);
  });

  it('is more robust to a contaminated baseline than the plain z-score', () => {
    const contaminated = [...baseline, 5000, 5000];

    expect(Math.abs(zScore(400, contaminated))).toBeLessThan(1);
    expect(Math.abs(modifiedZScore(400, contaminated))).toBeGreaterThan(3);
  });
});
