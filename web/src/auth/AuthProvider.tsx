import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { fetchCurrentUser, login as loginRequest } from '../api/endpoints.ts';
import { UNAUTHORIZED_EVENT, clearToken, readToken, writeToken } from './token.ts';
import { AuthContext } from './authContext.ts';
import type { AuthStatus } from './authContext.ts';
import type { CurrentUser } from '../api/types.ts';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>(readToken() === null ? 'anonymous' : 'checking');

  useEffect(() => {
    if (status !== 'checking') {
      return;
    }

    let cancelled = false;

    fetchCurrentUser()
      .then((current) => {
        if (!cancelled) {
          setUser(current);
          setStatus('authenticated');
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearToken();
          setUser(null);
          setStatus('anonymous');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    const onUnauthorized = (): void => {
      setUser(null);
      setStatus('anonymous');
    };

    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await loginRequest(email, password);
    writeToken(result.token);
    setUser(result.user);
    setStatus('authenticated');
  }, []);

  const signOut = useCallback(() => {
    clearToken();
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo(
    () => ({ status, user, signIn, signOut, isAdmin: user?.role === 'ADMIN' }),
    [status, user, signIn, signOut],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
