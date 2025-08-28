import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PageHeading } from '../components/PageHeading.tsx';
import { RangePicker } from '../components/RangePicker.tsx';
import { StateMessage } from '../components/StateMessage.tsx';
import { ErrorRateChart } from '../charts/ErrorRateChart.tsx';
import { LatencyChart } from '../charts/LatencyChart.tsx';
import { ResourceChart } from '../charts/ResourceChart.tsx';
import { ThroughputChart } from '../charts/ThroughputChart.tsx';
import { useMetricHistory } from '../hooks/useMetricHistory.ts';
import { useRefresh } from '../hooks/useRefresh.ts';
import { describeRange, parseRange } from '../lib/ranges.ts';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const windowSeconds = parseRange(searchParams.get('range'));

  const history = useMetricHistory({
    service: slug,
    metrics: METRICS,
    windowSeconds,
    refreshIntervalMs: effectiveIntervalMs,
  });

  const hint = describeRange(windowSeconds, history.stepSeconds);

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
          <>
            <RangePicker
              value={windowSeconds}
              onChange={(seconds) => {
                setSearchParams({ range: String(seconds) }, { replace: true });
              }}
            />
            <Link to="/" className="text-sm text-accent hover:underline">
              Back to overview
            </Link>
          </>
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
