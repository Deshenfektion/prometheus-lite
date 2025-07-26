import type { MetricSeries } from '../api/types.ts';

export interface ChartRow {
  t: number;
  [metric: string]: number | undefined;
}

export function toChartRows(series: MetricSeries[]): ChartRow[] {
  const byTimestamp = new Map<number, ChartRow>();

  for (const entry of series) {
    for (const point of entry.points) {
      const t = new Date(point.recordedAt).getTime();
      const row = byTimestamp.get(t) ?? { t };
      row[entry.metric] = point.value;
      byTimestamp.set(t, row);
    }
  }

  return [...byTimestamp.values()].sort((a, b) => a.t - b.t);
}

export function hasAnyPoints(series: MetricSeries[]): boolean {
  return series.some((entry) => entry.points.length > 0);
}

export function seriesByMetric(series: MetricSeries[], metric: string): MetricSeries | undefined {
  return series.find((entry) => entry.metric === metric);
}
