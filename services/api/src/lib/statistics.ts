export const MAD_TO_SIGMA = 0.6745;

export function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return Number.NaN;
  }
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total / values.length;
}

export function variance(values: readonly number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const average = mean(values);
  let total = 0;
  for (const value of values) {
    total += (value - average) ** 2;
  }
  return total / (values.length - 1);
}

export function standardDeviation(values: readonly number[]): number {
  return Math.sqrt(variance(values));
}

export function median(values: readonly number[]): number {
  if (values.length === 0) {
    return Number.NaN;
  }
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);

  if (ordered.length % 2 === 1) {
    return ordered[middle] as number;
  }
  return ((ordered[middle - 1] as number) + (ordered[middle] as number)) / 2;
}

export function medianAbsoluteDeviation(values: readonly number[]): number {
  if (values.length === 0) {
    return Number.NaN;
  }
  const centre = median(values);
  return median(values.map((value) => Math.abs(value - centre)));
}

export function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) {
    return Number.NaN;
  }
  const ordered = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(fraction * ordered.length);
  return ordered[Math.min(Math.max(rank - 1, 0), ordered.length - 1)] as number;
}

export function zScore(value: number, values: readonly number[]): number {
  const deviation = standardDeviation(values);
  if (deviation === 0) {
    return 0;
  }
  return (value - mean(values)) / deviation;
}

export function modifiedZScore(value: number, values: readonly number[]): number {
  const deviation = medianAbsoluteDeviation(values);
  if (deviation === 0) {
    return 0;
  }
  return (MAD_TO_SIGMA * (value - median(values))) / deviation;
}
