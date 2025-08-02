import { describe, expect, it } from 'vitest';
import {
  formatMilliseconds,
  formatPercent,
  formatRate,
  formatRatioAsPercent,
  formatRelativeTime,
} from '../lib/format.ts';

describe('formatMilliseconds', () => {
  it('switches to seconds above one second', () => {
    expect(formatMilliseconds(2500)).toBe('2.50 s');
  });

  it('drops decimals for large millisecond values', () => {
    expect(formatMilliseconds(432.7)).toBe('433 ms');
  });

  it('keeps one decimal for small values', () => {
    expect(formatMilliseconds(12.34)).toBe('12.3 ms');
  });

  it('renders a dash when there is no value', () => {
    expect(formatMilliseconds(undefined)).toBe('—');
  });
});

describe('percentages', () => {
  it('formats a percentage metric', () => {
    expect(formatPercent(42.4)).toBe('42.4%');
    expect(formatPercent(42.6, 0)).toBe('43%');
  });

  it('converts a ratio into a percentage', () => {
    expect(formatRatioAsPercent(0.0125)).toBe('1.25%');
    expect(formatRatioAsPercent(undefined)).toBe('—');
  });
});

describe('formatRate', () => {
  it('abbreviates thousands', () => {
    expect(formatRate(2400)).toBe('2.4k rps');
  });

  it('keeps a decimal below ten', () => {
    expect(formatRate(4.25)).toBe('4.3 rps');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2025-03-29T12:00:00.000Z').getTime();

  it('describes fresh data as just now', () => {
    expect(formatRelativeTime(new Date(now - 2000).toISOString(), now)).toBe('just now');
  });

  it('counts seconds, minutes, hours and days', () => {
    expect(formatRelativeTime(new Date(now - 30_000).toISOString(), now)).toBe('30s ago');
    expect(formatRelativeTime(new Date(now - 5 * 60_000).toISOString(), now)).toBe('5m ago');
    expect(formatRelativeTime(new Date(now - 3 * 3_600_000).toISOString(), now)).toBe('3h ago');
    expect(formatRelativeTime(new Date(now - 2 * 86_400_000).toISOString(), now)).toBe('2d ago');
  });

  it('handles a missing timestamp', () => {
    expect(formatRelativeTime(undefined, now)).toBe('never');
  });
});
