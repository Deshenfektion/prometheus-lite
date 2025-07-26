import type { ReactNode } from 'react';

interface ChartFrameProps {
  title: string;
  hint?: string;
  isEmpty?: boolean;
  emptyMessage?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function ChartFrame({
  title,
  hint,
  isEmpty = false,
  emptyMessage = 'No data in this window',
  actions,
  children,
}: ChartFrameProps) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">{title}</h3>
          {hint !== undefined && <p className="text-xs text-ink-faint">{hint}</p>}
        </div>
        {actions}
      </header>

      {isEmpty ? (
        <div className="flex h-48 items-center justify-center text-sm text-ink-faint">
          {emptyMessage}
        </div>
      ) : (
        <div className="h-48">{children}</div>
      )}
    </section>
  );
}
