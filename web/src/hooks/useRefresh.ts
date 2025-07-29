import { useContext } from 'react';
import { RefreshContext } from './refreshContext.ts';
import type { RefreshContextValue } from './refreshContext.ts';

export function useRefresh(): RefreshContextValue {
  const value = useContext(RefreshContext);

  if (value === null) {
    throw new Error('useRefresh must be used inside a RefreshProvider');
  }

  return value;
}
