export const MAX_CLOCK_SKEW_MS = 5 * 60_000;
export const MAX_BACKFILL_MS = 24 * 60 * 60_000;

export class TimestampError extends Error {}

export function normalizeTimestamp(input: string, now: Date = new Date()): Date {
  const parsed = new Date(input);
  const time = parsed.getTime();

  if (Number.isNaN(time)) {
    throw new TimestampError(`'${input}' is not a valid ISO-8601 timestamp`);
  }

  const drift = time - now.getTime();
  if (drift > MAX_CLOCK_SKEW_MS) {
    throw new TimestampError('timestamp is too far in the future');
  }
  if (-drift > MAX_BACKFILL_MS) {
    throw new TimestampError('timestamp is older than the accepted backfill window');
  }

  return new Date(time);
}

export function floorToInterval(date: Date, intervalSeconds: number): Date {
  const intervalMs = intervalSeconds * 1000;
  return new Date(Math.floor(date.getTime() / intervalMs) * intervalMs);
}

export function subtractSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() - seconds * 1000);
}
