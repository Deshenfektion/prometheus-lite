import { Link } from 'react-router-dom';
import { MetricStat } from './MetricStat.tsx';
import { StatusBadge } from './StatusBadge.tsx';
import {
  formatMilliseconds,
  formatPercent,
  formatRate,
  formatRatioAsPercent,
  formatRelativeTime,
} from '../lib/format.ts';
import { DEFAULT_THRESHOLDS } from '../lib/status.ts';
import type { DashboardService } from '../api/types.ts';

function reading(service: DashboardService, key: string): number | undefined {
  return service.metrics[key]?.value;
}

function latencyTone(value: number | undefined): 'default' | 'warning' | 'critical' {
  if (value === undefined) {
    return 'default';
  }
  if (value >= DEFAULT_THRESHOLDS.latencyCriticalMs) {
    return 'critical';
  }
  return value >= DEFAULT_THRESHOLDS.latencyWarningMs ? 'warning' : 'default';
}

function errorTone(value: number | undefined): 'default' | 'warning' | 'critical' {
  if (value === undefined) {
    return 'default';
  }
  if (value >= DEFAULT_THRESHOLDS.errorRateCritical) {
    return 'critical';
  }
  return value >= DEFAULT_THRESHOLDS.errorRateWarning ? 'warning' : 'default';
}

export function ServiceCard({ service }: { service: DashboardService }) {
  const p95 = reading(service, 'latency_p95_ms');
  const errorRate = reading(service, 'error_rate');

  return (
    <Link
      to={`/services/${service.slug}`}
      className="block rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-surface-raised"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{service.displayName}</h2>
          <p className="truncate font-mono text-xs text-ink-faint">{service.slug}</p>
        </div>
        <StatusBadge status={service.status} />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3">
        <MetricStat
          label="p95"
          value={formatMilliseconds(p95 ?? reading(service, 'latency_ms'))}
          tone={latencyTone(p95)}
        />
        <MetricStat
          label="errors"
          value={formatRatioAsPercent(errorRate)}
          tone={errorTone(errorRate)}
        />
        <MetricStat label="rps" value={formatRate(reading(service, 'throughput_rps'))} />
        <MetricStat label="cpu" value={formatPercent(reading(service, 'cpu_percent'), 0)} />
        <MetricStat label="memory" value={formatPercent(reading(service, 'memory_percent'), 0)} />
        <MetricStat label="avg" value={formatMilliseconds(reading(service, 'latency_avg_ms'))} />
      </dl>

      {service.reasons.length > 0 && (
        <p className="mt-3 truncate text-xs text-ink-muted" title={service.reasons.join('; ')}>
          {service.reasons[0]}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-ink-faint">
        <span className="rounded bg-surface-raised px-1.5 py-0.5">{service.environment}</span>
        <span>{formatRelativeTime(service.lastSeen ?? undefined)}</span>
      </div>
    </Link>
  );
}
