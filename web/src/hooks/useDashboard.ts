import { useQuery } from '@tanstack/react-query';
import { fetchDashboard } from '../api/endpoints.ts';
import type { DashboardSummary } from '../api/types.ts';

const EMPTY: DashboardSummary = {
  generatedAt: '',
  totals: {
    services: 0,
    ok: 0,
    warning: 0,
    critical: 0,
    unknown: 0,
    activeAlerts: 0,
    criticalAlerts: 0,
  },
  services: [],
  alerts: [],
};

export interface DashboardView {
  summary: DashboardSummary;
  environments: string[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
}

export function useDashboard(refreshIntervalMs: number): DashboardView {
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: refreshIntervalMs === 0 ? false : refreshIntervalMs,
  });

  const summary = query.data ?? EMPTY;

  return {
    summary,
    environments: [...new Set(summary.services.map((service) => service.environment))].sort(),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}
