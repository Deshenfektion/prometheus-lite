export function formatMilliseconds(value: number | undefined): string {
  if (value === undefined) {
    return '—';
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} s`;
  }
  if (value >= 100) {
    return `${Math.round(value)} ms`;
  }
  return `${value.toFixed(1)} ms`;
}

export function formatPercent(value: number | undefined, digits = 1): string {
  return value === undefined ? '—' : `${value.toFixed(digits)}%`;
}

export function formatRatioAsPercent(value: number | undefined, digits = 2): string {
  return value === undefined ? '—' : `${(value * 100).toFixed(digits)}%`;
}

export function formatRate(value: number | undefined): string {
  if (value === undefined) {
    return '—';
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k rps`;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} rps`;
}

export function formatRelativeTime(iso: string | undefined, now: number = Date.now()): string {
  if (iso === undefined) {
    return 'never';
  }

  const elapsed = Math.max(now - new Date(iso).getTime(), 0);
  const seconds = Math.round(elapsed / 1000);

  if (seconds < 5) {
    return 'just now';
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ago`;
  }
  if (seconds < 86_400) {
    return `${Math.floor(seconds / 3600)}h ago`;
  }
  return `${Math.floor(seconds / 86_400)}d ago`;
}

export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
