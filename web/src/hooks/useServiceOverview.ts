import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { fetchLatestMetrics, fetchServices } from '../api/endpoints.ts';
import { deriveHealth, staleAfterSeconds } from '../lib/status.ts';
import type { LatestSnapshot, Service } from '../api/types.ts';
import type { ServiceHealth } from '../lib/status.ts';

export interface ServiceOverviewRow {
  service: Service;
  snapshot: LatestSnapshot | undefined;
  health: ServiceHealth;
}

export interface ServiceOverview {
  rows: ServiceOverviewRow[];
  environments: string[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  updatedAt: number;
}

export function useServiceOverview(refreshIntervalMs: number): ServiceOverview {
  const [services, latest] = useQueries({
    queries: [
      {
        queryKey: ['services'],
        queryFn: () => fetchServices(),
        refetchInterval: refreshIntervalMs === 0 ? false : refreshIntervalMs * 4,
      },
      {
        queryKey: ['metrics', 'latest'],
        queryFn: fetchLatestMetrics,
        refetchInterval: refreshIntervalMs === 0 ? false : refreshIntervalMs,
      },
    ],
  });

  const rows = useMemo<ServiceOverviewRow[]>(() => {
    const registered = services.data ?? [];
    const snapshots = new Map((latest.data ?? []).map((entry) => [entry.service, entry]));

    return registered.map((service) => {
      const snapshot = snapshots.get(service.slug);
      const health = deriveHealth(snapshot, {
        staleAfter: staleAfterSeconds(service.pollIntervalSeconds),
      });
      return { service, snapshot, health };
    });
  }, [services.data, latest.data]);

  const environments = useMemo(
    () => [...new Set(rows.map((row) => row.service.environment))].sort(),
    [rows],
  );

  return {
    rows,
    environments,
    isLoading: services.isLoading || latest.isLoading,
    isFetching: services.isFetching || latest.isFetching,
    error: services.error ?? latest.error,
    updatedAt: Math.max(services.dataUpdatedAt, latest.dataUpdatedAt),
  };
}
