import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LatencyChart } from '../charts/LatencyChart.tsx';
import { hasAnyPoints, seriesByMetric, toChartRows } from '../charts/seriesData.ts';
import type { AnnotatedSeries } from '../api/types.ts';

function series(metric: string, values: Array<[string, number]>): AnnotatedSeries {
  return {
    service: 'checkout-api',
    metric,
    unit: 'milliseconds',
    stepSeconds: 60,
    points: values.map(([recordedAt, value]) => ({ recordedAt, value })),
    anomalies: [],
  };
}

describe('toChartRows', () => {
  it('merges series onto a shared timestamp axis', () => {
    const rows = toChartRows([
      series('latency_avg_ms', [
        ['2025-03-29T12:00:00.000Z', 10],
        ['2025-03-29T12:01:00.000Z', 12],
      ]),
      series('latency_p95_ms', [
        ['2025-03-29T12:00:00.000Z', 40],
        ['2025-03-29T12:01:00.000Z', 44],
      ]),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ latency_avg_ms: 10, latency_p95_ms: 40 });
    expect(rows[1]).toMatchObject({ latency_avg_ms: 12, latency_p95_ms: 44 });
  });

  it('sorts rows chronologically regardless of input order', () => {
    const rows = toChartRows([
      series('latency_avg_ms', [
        ['2025-03-29T12:05:00.000Z', 20],
        ['2025-03-29T12:00:00.000Z', 10],
      ]),
    ]);

    expect(rows.map((row) => row.latency_avg_ms)).toEqual([10, 20]);
  });

  it('leaves gaps where a series has no sample', () => {
    const rows = toChartRows([
      series('latency_avg_ms', [['2025-03-29T12:00:00.000Z', 10]]),
      series('latency_p95_ms', [['2025-03-29T12:01:00.000Z', 40]]),
    ]);

    expect(rows[0]?.latency_p95_ms).toBeUndefined();
    expect(rows[1]?.latency_avg_ms).toBeUndefined();
  });
});

describe('series helpers', () => {
  it('detects whether anything was collected', () => {
    expect(hasAnyPoints([series('latency_avg_ms', [])])).toBe(false);
    expect(hasAnyPoints([series('latency_avg_ms', [['2025-03-29T12:00:00.000Z', 1]])])).toBe(true);
  });

  it('finds a series by metric key', () => {
    const all = [series('latency_avg_ms', []), series('latency_p95_ms', [])];
    expect(seriesByMetric(all, 'latency_p95_ms')?.metric).toBe('latency_p95_ms');
    expect(seriesByMetric(all, 'cpu_percent')).toBeUndefined();
  });
});

describe('LatencyChart anomalies', () => {
  it('mentions marked outliers in the chart hint', () => {
    const withOutlier: AnnotatedSeries = {
      ...series('latency_p95_ms', [
        ['2025-04-29T12:00:00.000Z', 40],
        ['2025-04-29T12:01:00.000Z', 5000],
      ]),
      anomalies: [
        {
          recordedAt: '2025-04-29T12:01:00.000Z',
          value: 5000,
          score: 12.4,
          baseline: 42,
          direction: 'above',
        },
      ],
    };

    render(<LatencyChart series={[withOutlier]} hint="10s buckets" />);

    expect(screen.getByText('10s buckets · 1 p95 outlier marked')).toBeInTheDocument();
  });

  it('says nothing about outliers when there are none', () => {
    render(
      <LatencyChart
        series={[series('latency_p95_ms', [['2025-04-29T12:00:00.000Z', 40]])]}
        hint="10s buckets"
      />,
    );

    expect(screen.getByText('10s buckets')).toBeInTheDocument();
  });
});

describe('LatencyChart', () => {
  it('explains an empty window instead of drawing an empty plot', () => {
    render(<LatencyChart series={[series('latency_avg_ms', [])]} />);
    expect(screen.getByText('No data in this window')).toBeInTheDocument();
  });

  it('renders the chart frame and its hint when there is data', () => {
    render(
      <LatencyChart
        series={[series('latency_avg_ms', [['2025-03-29T12:00:00.000Z', 10]])]}
        hint="60s buckets, last hour"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Latency' })).toBeInTheDocument();
    expect(screen.getByText('60s buckets, last hour')).toBeInTheDocument();
    expect(screen.queryByText('No data in this window')).not.toBeInTheDocument();
  });
});
