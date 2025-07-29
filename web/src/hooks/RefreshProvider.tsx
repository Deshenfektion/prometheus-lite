import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { RefreshContext } from './refreshContext.ts';

const STORAGE_KEY = 'prometheus-lite.refresh';
const DEFAULT_INTERVAL_SECONDS = 10;

function readStoredInterval(): number {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const parsed = stored === null ? Number.NaN : Number.parseInt(stored, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_INTERVAL_SECONDS;
  } catch {
    return DEFAULT_INTERVAL_SECONDS;
  }
}

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [intervalSeconds, setInterval] = useState(readStoredInterval);
  const [hidden, setHidden] = useState(() => document.visibilityState === 'hidden');

  useEffect(() => {
    const onVisibilityChange = (): void => {
      setHidden(document.visibilityState === 'hidden');
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const value = useMemo(() => {
    const setIntervalSeconds = (seconds: number): void => {
      setInterval(seconds);
      try {
        window.localStorage.setItem(STORAGE_KEY, String(seconds));
      } catch {
        return;
      }
    };

    const paused = hidden || intervalSeconds === 0;

    return {
      intervalSeconds,
      setIntervalSeconds,
      paused,
      effectiveIntervalMs: paused ? 0 : intervalSeconds * 1000,
    };
  }, [intervalSeconds, hidden]);

  return <RefreshContext value={value}>{children}</RefreshContext>;
}
