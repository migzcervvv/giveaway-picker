import { useId } from 'react';
import { Button } from './Button';

export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange(value: number): void;
}) {
  const id = useId();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
      <div className="flex">
        <Button
          aria-label={`Decrease ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          −
        </Button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(event.target.valueAsNumber)}
          className="min-h-10 w-20 border-y border-[var(--muted)] bg-[var(--surface)] text-center text-lg tabular-nums"
        />
        <Button
          aria-label={`Increase ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          +
        </Button>
      </div>
    </div>
  );
}
