import { PageHeading } from '../components/PageHeading.tsx';
import { ServiceCard } from '../components/ServiceCard.tsx';
import { StateMessage } from '../components/StateMessage.tsx';
import { useServiceOverview } from '../hooks/useServiceOverview.ts';
import { useRefresh } from '../hooks/useRefresh.ts';

export function DashboardPage() {
  const { effectiveIntervalMs } = useRefresh();
  const overview = useServiceOverview(effectiveIntervalMs);

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
      <PageHeading
        title="Service overview"
        subtitle={`${overview.rows.length} registered service${overview.rows.length === 1 ? '' : 's'}`}
      />

      {overview.rows.length === 0 ? (
        <StateMessage
          title="No services registered"
          detail="Register a service through POST /api/v1/services to start collecting."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {overview.rows.map((row) => (
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
