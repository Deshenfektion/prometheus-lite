export const SERIES_COLORS = ['#3987e5', '#d95926', '#199e70'] as const;

export const STATUS_COLORS = {
  ok: '#3fb950',
  warning: '#d29922',
  critical: '#f85149',
  unknown: '#6e7681',
} as const;

export const CHART_SURFACE = '#121820';
export const GRID_COLOR = '#1f2937';
export const AXIS_TEXT_COLOR = '#8b98a5';

export const AXIS_TICK = { fill: AXIS_TEXT_COLOR, fontSize: 11 } as const;
export const LINE_WIDTH = 2;
export const ACTIVE_DOT_RADIUS = 4;
export const AREA_FILL_OPACITY = 0.1;

export const CHART_MARGIN = { top: 8, right: 12, bottom: 4, left: 4 } as const;

export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length] as string;
}

export function formatTimeTick(value: number): string {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTimeTick(value: number): string {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
