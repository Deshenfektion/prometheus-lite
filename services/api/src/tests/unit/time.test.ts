import { describe, expect, it } from 'vitest';
import {
  MAX_BACKFILL_MS,
  MAX_CLOCK_SKEW_MS,
  TimestampError,
  floorToInterval,
  normalizeTimestamp,
  subtractSeconds,
} from '../../lib/time.js';

const now = new Date('2025-02-09T12:00:00.000Z');

describe('normalizeTimestamp', () => {
  it('accepts an ISO timestamp in the recent past', () => {
    const result = normalizeTimestamp('2025-02-09T11:59:30.000Z', now);
    expect(result.toISOString()).toBe('2025-02-09T11:59:30.000Z');
  });

  it('converts an offset timestamp to the same instant', () => {
    const result = normalizeTimestamp('2025-02-09T12:59:30.000+01:00', now);
    expect(result.toISOString()).toBe('2025-02-09T11:59:30.000Z');
  });

  it('tolerates small clock skew into the future', () => {
    const slightlyAhead = new Date(now.getTime() + MAX_CLOCK_SKEW_MS - 1000).toISOString();
    expect(() => normalizeTimestamp(slightlyAhead, now)).not.toThrow();
  });

  it('rejects timestamps beyond the clock skew allowance', () => {
    const tooFarAhead = new Date(now.getTime() + MAX_CLOCK_SKEW_MS + 1000).toISOString();
    expect(() => normalizeTimestamp(tooFarAhead, now)).toThrow(TimestampError);
  });

  it('rejects timestamps older than the backfill window', () => {
    const tooOld = new Date(now.getTime() - MAX_BACKFILL_MS - 1000).toISOString();
    expect(() => normalizeTimestamp(tooOld, now)).toThrow(/backfill window/);
  });

  it('rejects unparseable input', () => {
    expect(() => normalizeTimestamp('yesterday', now)).toThrow(/not a valid ISO-8601/);
  });
});

describe('bucket helpers', () => {
  it('floors a timestamp onto an interval boundary', () => {
    const value = new Date('2025-02-09T12:07:43.512Z');
    expect(floorToInterval(value, 60).toISOString()).toBe('2025-02-09T12:07:00.000Z');
    expect(floorToInterval(value, 300).toISOString()).toBe('2025-02-09T12:05:00.000Z');
  });

  it('subtracts a window in seconds', () => {
    expect(subtractSeconds(now, 3600).toISOString()).toBe('2025-02-09T11:00:00.000Z');
  });
});
