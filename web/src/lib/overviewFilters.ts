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

export const STATUS_OPTIONS: Array<{ value: OverviewFilterState['status']; label: string }> = [
  { value: 'ALL', label: 'Any status' },
  { value: 'OK', label: 'Healthy' },
  { value: 'WARNING', label: 'Warning' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'UNKNOWN', label: 'No data' },
];
