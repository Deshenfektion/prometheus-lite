import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertBadge } from '../components/AlertBadge.tsx';
import { PageHeading } from '../components/PageHeading.tsx';
import { StateMessage } from '../components/StateMessage.tsx';
import { useAlerts } from '../hooks/useAlerts.ts';
import { useRefresh } from '../hooks/useRefresh.ts';
import { formatRelativeTime } from '../lib/format.ts';
import type { AlertState } from '../api/types.ts';

type StateFilter = AlertState | 'ALL';

const FILTERS: Array<{ value: StateFilter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'WARNING', label: 'Warning' },
  { value: 'OK', label: 'Recovered' },
];

function formatValue(value: number): string {
  return Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(3);
}

export function AlertsPage() {
  const { effectiveIntervalMs } = useRefresh();
  const alerts = useAlerts(effectiveIntervalMs);
  const [filter, setFilter] = useState<StateFilter>('ALL');

  if (alerts.error !== null) {
    return (
      <>
        <PageHeading title="Alerts" />
        <StateMessage title="Could not load alerts" detail={alerts.error.message} tone="critical" />
      </>
    );
  }

  const visibleEvents = alerts.events.filter(
    (event) => filter === 'ALL' || event.toState === filter,
  );

  return (
    <>
      <PageHeading
        title="Alerts"
        subtitle={`${alerts.active.length} firing · ${alerts.rules.length} rules configured`}
      />

      <section className="mb-6">
        <h2 className="mb-2 text-xs tracking-wide text-ink-faint uppercase">Firing now</h2>

        {alerts.isLoading ? (
          <StateMessage title="Loading alerts…" />
        ) : alerts.active.length === 0 ? (
          <StateMessage title="Nothing is firing" detail="Every rule is inside its thresholds." />
        ) : (
          <ul className="grid gap-2 lg:grid-cols-2">
            {alerts.active.map((alert) => (
              <li
                key={`${alert.ruleId}:${alert.serviceId}`}
                className="rounded-lg border border-line bg-surface p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <AlertBadge state={alert.state} />
                      <Link
                        to={`/services/${alert.serviceSlug}`}
                        className="truncate font-mono text-xs text-accent hover:underline"
                      >
                        {alert.serviceSlug}
                      </Link>
                    </div>
                    <p className="mt-1.5 text-sm font-medium">{alert.ruleName}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">{alert.message}</p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-faint">
                    {formatRelativeTime(alert.since)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs tracking-wide text-ink-faint uppercase">History</h2>
          <div className="flex items-center gap-1">
            {FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setFilter(option.value);
                }}
                aria-pressed={filter === option.value}
                className={`rounded-md px-2 py-1 text-xs transition-colors ${
                  filter === option.value
                    ? 'bg-surface-raised text-ink'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {visibleEvents.length === 0 ? (
          <StateMessage title="No alert events recorded yet" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-surface text-xs text-ink-faint">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Service</th>
                  <th className="px-3 py-2 font-medium">Rule</th>
                  <th className="px-3 py-2 font-medium">Transition</th>
                  <th className="px-3 py-2 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {visibleEvents.map((event) => (
                  <tr key={event.id} className="border-t border-line">
                    <td className="px-3 py-2 whitespace-nowrap text-ink-muted">
                      {formatRelativeTime(event.occurredAt)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link to={`/services/${event.serviceSlug}`} className="hover:text-accent">
                        {event.serviceSlug}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{event.ruleName}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1.5">
                        <AlertBadge state={event.fromState} />
                        <span className="text-ink-faint">&rarr;</span>
                        <AlertBadge state={event.toState} />
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {formatValue(event.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
