import type { OverviewFilterState } from '../components/OverviewFilters.tsx';
import type { DashboardService } from '../api/types.ts';

export function filterServices(
  services: DashboardService[],
  filters: OverviewFilterState,
): DashboardService[] {
  const needle = filters.search.trim().toLowerCase();

  return services.filter((service) => {
    if (filters.environment !== 'ALL' && service.environment !== filters.environment) {
      return false;
    }
    if (filters.status !== 'ALL' && service.status !== filters.status) {
      return false;
    }
    if (needle.length === 0) {
      return true;
    }
    return (
      service.slug.toLowerCase().includes(needle) ||
      service.displayName.toLowerCase().includes(needle)
    );
  });
}
