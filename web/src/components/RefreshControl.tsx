import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { REFRESH_OPTIONS } from '../hooks/refreshContext.ts';
import { useRefresh } from '../hooks/useRefresh.ts';

function optionLabel(seconds: number): string {
  return seconds === 0 ? 'off' : `${seconds}s`;
}

export function RefreshControl() {
  const { intervalSeconds, setIntervalSeconds, paused } = useRefresh();
  const queryClient = useQueryClient();
  const fetching = useIsFetching() > 0;

  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-1.5 w-1.5 rounded-full ${fetching ? 'bg-accent' : paused ? 'bg-unknown' : 'bg-ok'}`}
        title={paused ? 'auto-refresh paused' : 'auto-refresh active'}
        aria-hidden="true"
      />

      <label htmlFor="refresh-interval" className="sr-only">
        Auto-refresh interval
      </label>
      <select
        id="refresh-interval"
        value={intervalSeconds}
        onChange={(event) => {
          setIntervalSeconds(Number.parseInt(event.target.value, 10));
        }}
        className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink-muted outline-none focus:border-accent"
      >
        {REFRESH_OPTIONS.map((seconds) => (
          <option key={seconds} value={seconds}>
            {optionLabel(seconds)}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => {
          void queryClient.invalidateQueries();
        }}
        className="rounded-md border border-line px-2 py-1 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
      >
        Refresh
      </button>
    </div>
  );
}
