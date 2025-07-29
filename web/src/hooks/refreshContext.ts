import { createContext } from 'react';

export interface RefreshContextValue {
  intervalSeconds: number;
  setIntervalSeconds: (seconds: number) => void;
  paused: boolean;
  effectiveIntervalMs: number;
}

export const REFRESH_OPTIONS = [0, 5, 10, 30, 60] as const;

export const RefreshContext = createContext<RefreshContextValue | null>(null);
