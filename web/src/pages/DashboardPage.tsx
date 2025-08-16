import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ActiveAlertsBanner } from '../components/ActiveAlertsBanner.tsx';
import { PageHeading } from '../components/PageHeading.tsx';
import { OverviewFilters } from '../components/OverviewFilters.tsx';
import { ServiceCard } from '../components/ServiceCard.tsx';
import { StateMessage } from '../components/StateMessage.tsx';
import { filterServices } from '../lib/filterServices.ts';
import { useRefresh } from '../hooks/useRefresh.ts';
import { useActiveAlerts } from '../hooks/useAlerts.ts';
import { useServiceOverview } from '../hooks/useServiceOverview.ts';
import type { OverviewFilterState } from '../components/OverviewFilters.tsx';
import type { HealthStatus } from '../lib/status.ts';

const STATUSES: HealthStatus[] = ['OK', 'WARNING', 'CRITICAL', 'UNKNOWN'];

function readFilters(params: URLSearchParams): OverviewFilterState {
  const status = params.get('status');
  return {
    search: params.get('q') ?? '',
    environment: params.get('env') ?? 'ALL',
    status: STATUSES.find((candidate) => candidate === status) ?? 'ALL',
  };
}

function writeFilters(filters: OverviewFilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search.length > 0) {
    params.set('q', filters.search);
  }
  if (filters.environment !== 'ALL') {
    params.set('env', filters.environment);
  }
  if (filters.status !== 'ALL') {
    params.set('status', filters.status);
  }
  return params;
}

export function DashboardPage() {
  const { effectiveIntervalMs } = useRefresh();
  const overview = useServiceOverview(effectiveIntervalMs);
  const { active } = useActiveAlerts(effectiveIntervalMs);
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const visible = useMemo(() => filterServices(overview.rows, filters), [overview.rows, filters]);

  if (overview.isLoading) {
    return (
      <>
        <PageHeading title="Service overview" />
        <StateMessage title="Loading services…" />
      </>
    );
  }

  if (overview.error !== null) {
    return (
      <>
        <PageHeading title="Service overview" />
        <StateMessage
          title="Could not load services"
          detail={overview.error.message}
          tone="critical"
        />
      </>
    );
  }

  return (
    <>
      <PageHeading title="Service overview" subtitle="Health of every registered service" />

      <ActiveAlertsBanner alerts={active} />

      <OverviewFilters
        value={filters}
        environments={overview.environments}
        matched={visible.length}
        total={overview.rows.length}
        onChange={(next) => {
          setSearchParams(writeFilters(next), { replace: true });
        }}
      />

      {overview.rows.length === 0 ? (
        <StateMessage
          title="No services registered"
          detail="Register a service through POST /api/v1/services to start collecting."
        />
      ) : visible.length === 0 ? (
        <StateMessage
          title="No services match these filters"
          detail="Clear the filters to see the whole fleet again."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visible.map((row) => (
            <ServiceCard
              key={row.service.slug}
              service={row.service}
              snapshot={row.snapshot}
              health={row.health}
            />
          ))}
        </div>
      )}
    </>
  );
}
