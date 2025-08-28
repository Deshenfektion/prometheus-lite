import { RANGE_OPTIONS } from '../lib/ranges.ts';

interface RangePickerProps {
  value: number;
  onChange: (windowSeconds: number) => void;
}

export function RangePicker({ value, onChange }: RangePickerProps) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Time range">
      {RANGE_OPTIONS.map((option) => (
        <button
          key={option.seconds}
          type="button"
          onClick={() => {
            onChange(option.seconds);
          }}
          aria-pressed={value === option.seconds}
          className={`rounded-md px-2 py-1 text-xs transition-colors ${
            value === option.seconds
              ? 'bg-surface-raised text-ink'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
