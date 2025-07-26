import { formatDateTimeTick } from './chartTheme.ts';

export interface TooltipEntry {
  name?: string | number;
  value?: number | string | Array<number | string>;
  color?: string;
  dataKey?: string | number;
}

export interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: TooltipEntry[];
  formatValue: (value: number) => string;
  labels?: Record<string, string>;
}

export function ChartTooltip({
  active,
  label,
  payload,
  formatValue,
  labels = {},
}: ChartTooltipProps) {
  if (active !== true || payload === undefined || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-md border border-line-strong bg-surface-raised px-3 py-2 shadow-lg">
      <p className="mb-1.5 font-mono text-[11px] text-ink-faint">
        {typeof label === 'number' ? formatDateTimeTick(label) : String(label ?? '')}
      </p>
      <ul className="space-y-1">
        {payload.map((entry) => {
          const key = String(entry.dataKey ?? entry.name ?? '');
          return (
            <li key={key} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
                aria-hidden="true"
              />
              <span className="text-ink-muted">{labels[key] ?? key}</span>
              <span className="ml-auto font-mono text-ink">
                {typeof entry.value === 'number' ? formatValue(entry.value) : '—'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
