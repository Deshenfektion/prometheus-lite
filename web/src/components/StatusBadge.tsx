import type { HealthStatus } from '../api/types.ts';

const STYLES: Record<HealthStatus, { dot: string; text: string; label: string }> = {
  OK: { dot: 'bg-ok', text: 'text-ok', label: 'Healthy' },
  WARNING: { dot: 'bg-warning', text: 'text-warning', label: 'Warning' },
  CRITICAL: { dot: 'bg-critical', text: 'text-critical', label: 'Critical' },
  UNKNOWN: { dot: 'bg-unknown', text: 'text-unknown', label: 'No data' },
};

interface StatusBadgeProps {
  status: HealthStatus;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const style = STYLES[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${style.text}`}
      data-status={status}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
      {label ?? style.label}
    </span>
  );
}
