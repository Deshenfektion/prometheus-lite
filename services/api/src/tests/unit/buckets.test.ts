import { describe, expect, it } from 'vitest';
import { chooseStep, expectedBuckets, snapStep } from '../../lib/buckets.js';

describe('chooseStep', () => {
  it('returns null when raw points already fit the budget', () => {
    expect(chooseStep(300, 500)).toBeNull();
  });

  it('picks a step that keeps the series under the budget', () => {
    const step = chooseStep(24 * 3600, 500);
    expect(step).not.toBeNull();
    expect(expectedBuckets(24 * 3600, step as number)).toBeLessThanOrEqual(500);
  });

  it('grows the step as the window grows', () => {
    const hour = chooseStep(3600, 200) ?? 1;
    const week = chooseStep(7 * 24 * 3600, 200) ?? 1;
    expect(week).toBeGreaterThan(hour);
  });

  it('caps at the largest ladder entry', () => {
    expect(chooseStep(365 * 24 * 3600, 1)).toBe(86_400);
  });

  it('rejects nonsensical inputs', () => {
    expect(chooseStep(0, 100)).toBeNull();
    expect(chooseStep(3600, 0)).toBeNull();
  });
});

describe('snapStep', () => {
  it('rounds a requested step up to the nearest ladder entry', () => {
    expect(snapStep(1)).toBe(1);
    expect(snapStep(7)).toBe(10);
    expect(snapStep(45)).toBe(60);
    expect(snapStep(100_000)).toBe(86_400);
  });
});
