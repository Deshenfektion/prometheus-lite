import type { HealthStatus } from '../api/types.ts';

export interface OverviewFilterState {
  search: string;
  environment: string;
  status: HealthStatus | 'ALL';
}

export const EMPTY_FILTERS: OverviewFilterState = {
  search: '',
  environment: 'ALL',
  status: 'ALL',
};

const STATUS_OPTIONS: Array<{ value: OverviewFilterState['status']; label: string }> = [
  { value: 'ALL', label: 'Any status' },
  { value: 'OK', label: 'Healthy' },
  { value: 'WARNING', label: 'Warning' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'UNKNOWN', label: 'No data' },
];

const CONTROL_CLASS =
  'rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent';

interface OverviewFiltersProps {
  value: OverviewFilterState;
  environments: string[];
  matched: number;
  total: number;
  onChange: (next: OverviewFilterState) => void;
}

export function OverviewFilters({
  value,
  environments,
  matched,
  total,
  onChange,
}: OverviewFiltersProps) {
  const isFiltered = matched !== total;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <label htmlFor="filter-search" className="sr-only">
        Filter services by name
      </label>
      <input
        id="filter-search"
        type="search"
        placeholder="Filter by name…"
        value={value.search}
        onChange={(event) => {
          onChange({ ...value, search: event.target.value });
        }}
        className={`${CONTROL_CLASS} w-48`}
      />

      <label htmlFor="filter-environment" className="sr-only">
        Environment
      </label>
      <select
        id="filter-environment"
        value={value.environment}
        onChange={(event) => {
          onChange({ ...value, environment: event.target.value });
        }}
        className={CONTROL_CLASS}
      >
        <option value="ALL">Any environment</option>
        {environments.map((environment) => (
          <option key={environment} value={environment}>
            {environment}
          </option>
        ))}
      </select>

      <label htmlFor="filter-status" className="sr-only">
        Health status
      </label>
      <select
        id="filter-status"
        value={value.status}
        onChange={(event) => {
          onChange({ ...value, status: event.target.value as OverviewFilterState['status'] });
        }}
        className={CONTROL_CLASS}
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <span className="ml-auto text-xs text-ink-faint">
        {isFiltered ? `${matched} of ${total} services` : `${total} services`}
      </span>

      {isFiltered && (
        <button
          type="button"
          onClick={() => {
            onChange(EMPTY_FILTERS);
          }}
          className="rounded-md border border-line px-2 py-1 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
        >
          Clear
        </button>
      )}
    </div>
  );
}
