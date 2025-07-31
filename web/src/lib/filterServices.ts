import type { OverviewFilterState } from '../components/OverviewFilters.tsx';
import type { ServiceOverviewRow } from '../hooks/useServiceOverview.ts';

export function filterServices(
  rows: ServiceOverviewRow[],
  filters: OverviewFilterState,
): ServiceOverviewRow[] {
  const needle = filters.search.trim().toLowerCase();

  return rows.filter((row) => {
    if (filters.environment !== 'ALL' && row.service.environment !== filters.environment) {
      return false;
    }
    if (filters.status !== 'ALL' && row.health.status !== filters.status) {
      return false;
    }
    if (needle.length === 0) {
      return true;
    }
    return (
      row.service.slug.toLowerCase().includes(needle) ||
      row.service.displayName.toLowerCase().includes(needle)
    );
  });
}
