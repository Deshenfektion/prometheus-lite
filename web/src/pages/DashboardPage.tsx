import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ActiveAlertsBanner } from '../components/ActiveAlertsBanner.tsx';
import { PageHeading } from '../components/PageHeading.tsx';
import { OverviewFilters } from '../components/OverviewFilters.tsx';
import { ServiceCard } from '../components/ServiceCard.tsx';
import { StateMessage } from '../components/StateMessage.tsx';
import { filterServices } from '../lib/filterServices.ts';
import { useRefresh } from '../hooks/useRefresh.ts';
import { useDashboard } from '../hooks/useDashboard.ts';
import type { OverviewFilterState } from '../lib/overviewFilters.ts';
import type { HealthStatus } from '../api/types.ts';

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
  const dashboard = useDashboard(effectiveIntervalMs);
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const visible = useMemo(
    () => filterServices(dashboard.summary.services, filters),
    [dashboard.summary.services, filters],
  );

  if (dashboard.isLoading) {
    return (
      <>
        <PageHeading title="Service overview" />
        <StateMessage title="Loading services…" />
      </>
    );
  }

  if (dashboard.error !== null) {
    return (
      <>
        <PageHeading title="Service overview" />
        <StateMessage
          title="Could not load services"
          detail={dashboard.error.message}
          tone="critical"
        />
      </>
    );
  }

  return (
    <>
      <PageHeading title="Service overview" subtitle="Health of every registered service" />

      <ActiveAlertsBanner alerts={dashboard.summary.alerts} />

      <OverviewFilters
        value={filters}
        environments={dashboard.environments}
        matched={visible.length}
        total={dashboard.summary.totals.services}
        onChange={(next) => {
          setSearchParams(writeFilters(next), { replace: true });
        }}
      />

      {dashboard.summary.services.length === 0 ? (
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
          {visible.map((service) => (
            <ServiceCard key={service.slug} service={service} />
          ))}
        </div>
      )}
    </>
  );
}
