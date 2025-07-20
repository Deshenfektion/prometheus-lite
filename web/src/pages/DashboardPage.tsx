import { PageHeading } from '../components/PageHeading.tsx';

export function DashboardPage() {
  return (
    <>
      <PageHeading title="Service overview" subtitle="Health of every registered service" />
      <p className="text-sm text-ink-muted">Service cards land here once the API is wired up.</p>
    </>
  );
}
