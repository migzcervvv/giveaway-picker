import { useId } from 'react';

export function Switch({
  label,
  checked,
  onChange,
  disabled = false,
  describedBy,
}: {
  label: string;
  checked: boolean;
  onChange(checked: boolean): void;
  disabled?: boolean;
  describedBy?: string;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex min-h-10 cursor-pointer items-center justify-between gap-5 py-2 text-sm leading-relaxed"
    >
      <span>{label}</span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.checked)}
        className="h-6 w-6 shrink-0 accent-[var(--accent)] disabled:opacity-50"
      />
    </label>
  );
}
