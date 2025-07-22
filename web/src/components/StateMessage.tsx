interface StateMessageProps {
  title: string;
  detail?: string;
  tone?: 'neutral' | 'critical';
}

export function StateMessage({ title, detail, tone = 'neutral' }: StateMessageProps) {
  const border = tone === 'critical' ? 'border-critical/40' : 'border-line';

  return (
    <div className={`rounded-lg border ${border} bg-surface px-4 py-6 text-center`}>
      <p className={`text-sm font-medium ${tone === 'critical' ? 'text-critical' : 'text-ink'}`}>
        {title}
      </p>
      {detail !== undefined && <p className="mt-1 text-sm text-ink-muted">{detail}</p>}
    </div>
  );
}
