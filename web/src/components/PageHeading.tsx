import type { ReactNode } from 'react';

interface PageHeadingProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeading({ title, subtitle, actions }: PageHeadingProps) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-base font-semibold tracking-tight">{title}</h1>
        {subtitle !== undefined && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions !== undefined && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
