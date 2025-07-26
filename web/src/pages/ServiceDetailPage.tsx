import { Link, useParams } from 'react-router-dom';
import { PageHeading } from '../components/PageHeading.tsx';
import { StateMessage } from '../components/StateMessage.tsx';
import { LatencyChart } from '../charts/LatencyChart.tsx';
import { useMetricHistory } from '../hooks/useMetricHistory.ts';

const WINDOW_SECONDS = 3600;
const REFRESH_INTERVAL_MS = 15_000;

const LATENCY_METRICS = ['latency_avg_ms', 'latency_p95_ms', 'latency_p99_ms'];

export function ServiceDetailPage() {
  const { slug = '' } = useParams<{ slug: string }>();

  const history = useMetricHistory({
    service: slug,
    metrics: LATENCY_METRICS,
    windowSeconds: WINDOW_SECONDS,
    refreshIntervalMs: REFRESH_INTERVAL_MS,
  });

  const hint =
    history.stepSeconds === null
      ? 'raw samples, last hour'
      : `${history.stepSeconds}s buckets, last hour`;

  return (
    <>
      <PageHeading
        title={slug}
        subtitle="Historical trends"
        actions={
          <Link to="/" className="text-sm text-accent hover:underline">
            Back to overview
          </Link>
        }
      />

      {history.error !== null ? (
        <StateMessage
          title="Could not load history"
          detail={history.error.message}
          tone="critical"
        />
      ) : history.isLoading ? (
        <StateMessage title="Loading history…" />
      ) : (
        <div className="grid gap-3">
          <LatencyChart series={history.series} hint={hint} />
        </div>
      )}
    </>
  );
}
