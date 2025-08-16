import type { AlertState } from '../api/types.ts';

const STYLES: Record<AlertState, string> = {
  OK: 'border-ok/40 bg-ok/10 text-ok',
  WARNING: 'border-warning/40 bg-warning/10 text-warning',
  CRITICAL: 'border-critical/40 bg-critical/10 text-critical',
};

export function AlertBadge({ state }: { state: AlertState }) {
  return (
    <span
      className={`inline-flex rounded border px-1.5 py-0.5 font-mono text-[11px] ${STYLES[state]}`}
      data-alert-state={state}
    >
      {state}
    </span>
  );
}
