import { useContext } from 'react';
import { AuthContext } from './authContext.ts';
import type { AuthContextValue } from './authContext.ts';

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (value === null) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }

  return value;
}
