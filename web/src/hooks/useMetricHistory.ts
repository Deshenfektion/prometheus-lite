import { useQuery } from '@tanstack/react-query';
import { fetchMetricHistory } from '../api/endpoints.ts';
import type { MetricSeries } from '../api/types.ts';

export interface MetricHistoryOptions {
  service: string;
  metrics: string[];
  windowSeconds: number;
  refreshIntervalMs: number;
  enabled?: boolean;
}

export interface MetricHistoryResult {
  series: MetricSeries[];
  stepSeconds: number | null;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
}

export function useMetricHistory(options: MetricHistoryOptions): MetricHistoryResult {
  const { service, metrics, windowSeconds, refreshIntervalMs, enabled = true } = options;

  const query = useQuery({
    queryKey: ['metrics', 'history', service, metrics.join(','), windowSeconds],
    queryFn: () =>
      fetchMetricHistory({
        service,
        metrics,
        from: new Date(Date.now() - windowSeconds * 1000).toISOString(),
      }),
    enabled: enabled && service.length > 0,
    refetchInterval: refreshIntervalMs === 0 ? false : refreshIntervalMs,
  });

  const series = query.data ?? [];

  return {
    series,
    stepSeconds: series[0]?.stepSeconds ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}
