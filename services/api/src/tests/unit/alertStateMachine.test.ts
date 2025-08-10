import { describe, expect, it } from 'vitest';
import { decide, isEscalation } from '../../services/alertStateMachine.js';
import type { PendingSnapshot } from '../../services/alertStateMachine.js';

const T0 = new Date('2025-04-12T10:00:00.000Z');

function at(secondsAfterT0: number): Date {
  return new Date(T0.getTime() + secondsAfterT0 * 1000);
}

function snapshot(overrides: Partial<PendingSnapshot> = {}): PendingSnapshot {
  return { state: 'OK', since: T0, pendingState: null, pendingSince: null, ...overrides };
}

describe('isEscalation', () => {
  it('ranks severities', () => {
    expect(isEscalation('OK', 'WARNING')).toBe(true);
    expect(isEscalation('WARNING', 'CRITICAL')).toBe(true);
    expect(isEscalation('CRITICAL', 'WARNING')).toBe(false);
    expect(isEscalation('WARNING', 'OK')).toBe(false);
  });
});

describe('decide', () => {
  it('does nothing while the state is unchanged', () => {
    const decision = decide(snapshot(), 'OK', 120, at(30));

    expect(decision.changed).toBe(false);
    expect(decision.state).toBe('OK');
    expect(decision.since).toEqual(T0);
  });

  it('fires immediately when the rule has no hold-down', () => {
    const decision = decide(snapshot(), 'CRITICAL', 0, at(10));

    expect(decision.changed).toBe(true);
    expect(decision.state).toBe('CRITICAL');
    expect(decision.since).toEqual(at(10));
  });

  it('starts a pending window instead of firing straight away', () => {
    const decision = decide(snapshot(), 'WARNING', 120, at(10));

    expect(decision.changed).toBe(false);
    expect(decision.state).toBe('OK');
    expect(decision.pendingState).toBe('WARNING');
    expect(decision.pendingSince).toEqual(at(10));
  });

  it('keeps the original pending timestamp while the breach persists', () => {
    const pending = snapshot({ pendingState: 'WARNING', pendingSince: at(10) });
    const decision = decide(pending, 'WARNING', 120, at(60));

    expect(decision.changed).toBe(false);
    expect(decision.pendingSince).toEqual(at(10));
  });

  it('fires once the breach has been held for long enough', () => {
    const pending = snapshot({ pendingState: 'WARNING', pendingSince: at(10) });
    const decision = decide(pending, 'WARNING', 120, at(130));

    expect(decision.changed).toBe(true);
    expect(decision.state).toBe('WARNING');
    expect(decision.pendingState).toBeNull();
  });

  it('discards the pending window when the breach clears', () => {
    const pending = snapshot({ pendingState: 'WARNING', pendingSince: at(10) });
    const decision = decide(pending, 'OK', 120, at(60));

    expect(decision.changed).toBe(false);
    expect(decision.state).toBe('OK');
    expect(decision.pendingState).toBeNull();
    expect(decision.pendingSince).toBeNull();
  });

  it('restarts the pending window when the severity changes', () => {
    const pending = snapshot({ pendingState: 'WARNING', pendingSince: at(10) });
    const decision = decide(pending, 'CRITICAL', 120, at(60));

    expect(decision.changed).toBe(false);
    expect(decision.pendingState).toBe('CRITICAL');
    expect(decision.pendingSince).toEqual(at(60));
  });

  it('recovers immediately without waiting out the hold-down', () => {
    const firing = snapshot({ state: 'CRITICAL', since: at(0) });
    const decision = decide(firing, 'OK', 300, at(30));

    expect(decision.changed).toBe(true);
    expect(decision.state).toBe('OK');
    expect(decision.since).toEqual(at(30));
  });

  it('de-escalates immediately from critical to warning', () => {
    const firing = snapshot({ state: 'CRITICAL', since: at(0) });
    const decision = decide(firing, 'WARNING', 300, at(30));

    expect(decision.changed).toBe(true);
    expect(decision.state).toBe('WARNING');
  });
});
