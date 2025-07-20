import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', end: true },
  { to: '/alerts', label: 'Alerts', end: false },
];

function navClass({ isActive }: { isActive: boolean }): string {
  const base = 'rounded-md px-3 py-1.5 text-sm transition-colors';
  return isActive
    ? `${base} bg-surface-raised text-ink`
    : `${base} text-ink-muted hover:bg-surface hover:text-ink`;
}

export function Layout({ toolbar }: { toolbar?: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4 px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold tracking-tight">prometheus</span>
            <span className="font-mono text-xs text-ink-faint">lite</span>
          </div>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">{toolbar}</div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5">
        <Outlet />
      </main>

      <footer className="border-t border-line px-4 py-3 text-center font-mono text-xs text-ink-faint">
        polling · storing · alerting
      </footer>
    </div>
  );
}
