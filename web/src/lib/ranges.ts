export interface RangeOption {
  label: string;
  seconds: number;
}

export const RANGE_OPTIONS: RangeOption[] = [
  { label: '15m', seconds: 900 },
  { label: '1h', seconds: 3600 },
  { label: '6h', seconds: 21_600 },
  { label: '24h', seconds: 86_400 },
  { label: '7d', seconds: 604_800 },
];

export const DEFAULT_RANGE_SECONDS = 3600;

export function parseRange(raw: string | null): number {
  const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);
  return RANGE_OPTIONS.some((option) => option.seconds === parsed) ? parsed : DEFAULT_RANGE_SECONDS;
}

export function describeRange(windowSeconds: number, stepSeconds: number | null): string {
  const option = RANGE_OPTIONS.find((entry) => entry.seconds === windowSeconds);
  const range = option === undefined ? `${windowSeconds}s` : `last ${option.label}`;
  return stepSeconds === null ? `raw samples, ${range}` : `${stepSeconds}s buckets, ${range}`;
}
