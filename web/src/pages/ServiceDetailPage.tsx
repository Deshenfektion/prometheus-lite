import { Link, useParams } from 'react-router-dom';
import { PageHeading } from '../components/PageHeading.tsx';
import { StateMessage } from '../components/StateMessage.tsx';
import { ErrorRateChart } from '../charts/ErrorRateChart.tsx';
import { LatencyChart } from '../charts/LatencyChart.tsx';
import { ResourceChart } from '../charts/ResourceChart.tsx';
import { ThroughputChart } from '../charts/ThroughputChart.tsx';
import { useMetricHistory } from '../hooks/useMetricHistory.ts';
import { useRefresh } from '../hooks/useRefresh.ts';

const WINDOW_SECONDS = 3600;

const METRICS = [
  'latency_avg_ms',
  'latency_p95_ms',
  'latency_p99_ms',
  'throughput_rps',
  'error_rate',
  'cpu_percent',
  'memory_percent',
];

export function ServiceDetailPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { effectiveIntervalMs } = useRefresh();

  const history = useMetricHistory({
    service: slug,
    metrics: METRICS,
    windowSeconds: WINDOW_SECONDS,
    refreshIntervalMs: effectiveIntervalMs,
  });

  const hint =
    history.stepSeconds === null
      ? 'raw samples, last hour'
      : `${history.stepSeconds}s buckets, last hour`;

  if (history.error !== null) {
    return (
      <>
        <PageHeading title={slug} subtitle="Historical trends" />
        <StateMessage
          title="Could not load history"
          detail={history.error.message}
          tone="critical"
        />
      </>
    );
  }

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

      {history.isLoading ? (
        <StateMessage title="Loading history…" />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          <LatencyChart series={history.series} hint={hint} />
          <ThroughputChart series={history.series} hint={hint} />
          <ErrorRateChart series={history.series} hint={hint} />
          <ResourceChart series={history.series} hint={hint} />
        </div>
      )}
    </>
  );
}
