import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth.ts';
import type { Role } from '../api/types.ts';

interface RequireAuthProps {
  role?: Role;
}

export function RequireAuth({ role }: RequireAuthProps) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'checking') {
    return (
      <div className="flex min-h-full items-center justify-center py-20 text-sm text-ink-muted">
        Checking your session…
      </div>
    );
  }

  if (status === 'anonymous' || user === null) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (role !== undefined && user.role !== role) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-lg font-semibold text-critical">Not allowed</h1>
        <p className="mt-1 text-sm text-ink-muted">
          This page needs the {role} role. You are signed in as {user.role}.
        </p>
      </div>
    );
  }

  return <Outlet />;
}
