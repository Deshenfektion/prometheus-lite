import { useQueries } from '@tanstack/react-query';
import { fetchActiveAlerts, fetchAlertEvents, fetchAlertRules } from '../api/endpoints.ts';
import type { ActiveAlert, AlertEvent, AlertRule } from '../api/types.ts';

export interface AlertsView {
  active: ActiveAlert[];
  events: AlertEvent[];
  rules: AlertRule[];
  isLoading: boolean;
  error: Error | null;
}

export function useAlerts(refreshIntervalMs: number): AlertsView {
  const interval = refreshIntervalMs === 0 ? false : refreshIntervalMs;

  const [active, events, rules] = useQueries({
    queries: [
      { queryKey: ['alerts', 'active'], queryFn: fetchActiveAlerts, refetchInterval: interval },
      {
        queryKey: ['alerts', 'events'],
        queryFn: () => fetchAlertEvents({ limit: 50 }),
        refetchInterval: interval,
      },
      { queryKey: ['alerts', 'rules'], queryFn: fetchAlertRules, refetchInterval: false as const },
    ],
  });

  return {
    active: active.data ?? [],
    events: events.data ?? [],
    rules: rules.data ?? [],
    isLoading: active.isLoading || events.isLoading || rules.isLoading,
    error: active.error ?? events.error ?? rules.error,
  };
}

export function useActiveAlerts(refreshIntervalMs: number): {
  active: ActiveAlert[];
  isLoading: boolean;
} {
  const [active] = useQueries({
    queries: [
      {
        queryKey: ['alerts', 'active'],
        queryFn: fetchActiveAlerts,
        refetchInterval: refreshIntervalMs === 0 ? false : refreshIntervalMs,
      },
    ],
  });

  return { active: active.data ?? [], isLoading: active.isLoading };
}
