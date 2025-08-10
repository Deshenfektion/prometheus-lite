import type { AlertState } from '../types/alerts.js';

export interface PendingSnapshot {
  state: AlertState;
  since: Date;
  pendingState: AlertState | null;
  pendingSince: Date | null;
}

export interface Decision {
  state: AlertState;
  since: Date;
  pendingState: AlertState | null;
  pendingSince: Date | null;
  changed: boolean;
}

const SEVERITY: Record<AlertState, number> = { OK: 0, WARNING: 1, CRITICAL: 2 };

export function isEscalation(from: AlertState, to: AlertState): boolean {
  return SEVERITY[to] > SEVERITY[from];
}

export function decide(
  current: PendingSnapshot,
  observed: AlertState,
  forSeconds: number,
  now: Date,
): Decision {
  if (observed === current.state) {
    return {
      state: current.state,
      since: current.since,
      pendingState: null,
      pendingSince: null,
      changed: false,
    };
  }

  const holdDown = forSeconds > 0 && isEscalation(current.state, observed);

  if (!holdDown) {
    return {
      state: observed,
      since: now,
      pendingState: null,
      pendingSince: null,
      changed: true,
    };
  }

  const continuingPending = current.pendingState === observed && current.pendingSince !== null;
  const pendingSince = continuingPending ? (current.pendingSince as Date) : now;
  const heldForSeconds = (now.getTime() - pendingSince.getTime()) / 1000;

  if (heldForSeconds >= forSeconds) {
    return {
      state: observed,
      since: now,
      pendingState: null,
      pendingSince: null,
      changed: true,
    };
  }

  return {
    state: current.state,
    since: current.since,
    pendingState: observed,
    pendingSince,
    changed: false,
  };
}
