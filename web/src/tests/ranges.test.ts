import { describe, expect, it } from 'vitest';
import { DEFAULT_RANGE_SECONDS, describeRange, parseRange } from '../lib/ranges.ts';

describe('parseRange', () => {
  it('accepts a known range', () => {
    expect(parseRange('86400')).toBe(86_400);
  });

  it('falls back to the default for anything unrecognised', () => {
    expect(parseRange(null)).toBe(DEFAULT_RANGE_SECONDS);
    expect(parseRange('12345')).toBe(DEFAULT_RANGE_SECONDS);
    expect(parseRange('an hour please')).toBe(DEFAULT_RANGE_SECONDS);
  });
});

describe('describeRange', () => {
  it('names the bucket size and the range', () => {
    expect(describeRange(3600, 60)).toBe('60s buckets, last 1h');
    expect(describeRange(86_400, 300)).toBe('300s buckets, last 24h');
  });

  it('says when the series is unaggregated', () => {
    expect(describeRange(900, null)).toBe('raw samples, last 15m');
  });
});
