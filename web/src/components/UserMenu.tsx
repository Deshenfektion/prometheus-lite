import { useAuth } from '../auth/useAuth.ts';

export function UserMenu() {
  const { user, signOut } = useAuth();

  if (user === null) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-right leading-tight">
        <p className="text-xs font-medium">{user.displayName}</p>
        <p className="font-mono text-[11px] text-ink-faint">{user.role}</p>
      </div>
      <button
        type="button"
        onClick={signOut}
        className="rounded-md border border-line px-2.5 py-1 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
      >
        Sign out
      </button>
    </div>
  );
}
