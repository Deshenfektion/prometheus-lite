import { useParams } from 'react-router-dom';
import { PageHeading } from '../components/PageHeading.tsx';

export function ServiceDetailPage() {
  const { slug } = useParams<{ slug: string }>();

  return (
    <>
      <PageHeading title={slug ?? 'Service'} subtitle="Historical trends" />
      <p className="text-sm text-ink-muted">Charts arrive with the next milestone.</p>
    </>
  );
}
