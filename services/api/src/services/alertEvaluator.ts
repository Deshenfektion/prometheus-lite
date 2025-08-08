import type { AlertRule, AlertState, Comparison } from '../types/alerts.js';

export interface ThresholdVerdict {
  state: AlertState;
  threshold: number | null;
}

export function breaches(value: number, threshold: number, comparison: Comparison): boolean {
  return comparison === 'ABOVE' ? value >= threshold : value <= threshold;
}

export function evaluateThreshold(rule: AlertRule, value: number): ThresholdVerdict {
  if (rule.criticalThreshold !== null && breaches(value, rule.criticalThreshold, rule.comparison)) {
    return { state: 'CRITICAL', threshold: rule.criticalThreshold };
  }

  if (rule.warningThreshold !== null && breaches(value, rule.warningThreshold, rule.comparison)) {
    return { state: 'WARNING', threshold: rule.warningThreshold };
  }

  return { state: 'OK', threshold: null };
}

export function describeBreach(rule: AlertRule, verdict: ThresholdVerdict, value: number): string {
  const rounded = Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(3);

  if (verdict.state === 'OK') {
    return `${rule.metricKey} recovered to ${rounded}`;
  }

  const direction = rule.comparison === 'ABOVE' ? 'above' : 'below';
  return (
    `${rule.metricKey} ${rounded} is ${direction} the ${verdict.state.toLowerCase()} ` +
    `threshold of ${String(verdict.threshold)} ` +
    `(${rule.aggregation} over ${rule.windowSeconds}s)`
  );
}
