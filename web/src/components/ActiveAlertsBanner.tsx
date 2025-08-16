import { Link } from 'react-router-dom';
import { AlertBadge } from './AlertBadge.tsx';
import type { ActiveAlert } from '../api/types.ts';

const MAX_VISIBLE = 4;

export function ActiveAlertsBanner({ alerts }: { alerts: ActiveAlert[] }) {
  if (alerts.length === 0) {
    return null;
  }

  const critical = alerts.filter((alert) => alert.state === 'CRITICAL').length;
  const visible = alerts.slice(0, MAX_VISIBLE);
  const tone = critical > 0 ? 'border-critical/40' : 'border-warning/40';

  return (
    <section className={`mb-4 rounded-lg border ${tone} bg-surface p-3`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs tracking-wide text-ink-faint uppercase">
          {alerts.length} alert{alerts.length === 1 ? '' : 's'} firing
          {critical > 0 && ` · ${critical} critical`}
        </h2>
        <Link to="/alerts" className="text-xs text-accent hover:underline">
          View all
        </Link>
      </div>

      <ul className="grid gap-1.5 md:grid-cols-2">
        {visible.map((alert) => (
          <li
            key={`${alert.ruleId}:${alert.serviceId}`}
            className="flex items-center gap-2 text-xs"
          >
            <AlertBadge state={alert.state} />
            <Link
              to={`/services/${alert.serviceSlug}`}
              className="font-mono text-ink hover:text-accent"
            >
              {alert.serviceSlug}
            </Link>
            <span className="truncate text-ink-muted">{alert.ruleName}</span>
          </li>
        ))}
      </ul>

      {alerts.length > MAX_VISIBLE && (
        <p className="mt-2 text-xs text-ink-faint">and {alerts.length - MAX_VISIBLE} more</p>
      )}
    </section>
  );
}
