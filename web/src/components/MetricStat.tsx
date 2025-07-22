interface MetricStatProps {
  label: string;
  value: string;
  tone?: 'default' | 'warning' | 'critical';
}

const TONES = {
  default: 'text-ink',
  warning: 'text-warning',
  critical: 'text-critical',
} as const;

export function MetricStat({ label, value, tone = 'default' }: MetricStatProps) {
  return (
    <div>
      <dt className="text-[11px] tracking-wide text-ink-faint uppercase">{label}</dt>
      <dd className={`mt-0.5 font-mono text-sm ${TONES[tone]}`}>{value}</dd>
    </div>
  );
}
