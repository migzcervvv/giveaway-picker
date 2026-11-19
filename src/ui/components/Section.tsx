import { useId } from 'react';
import type { ReactNode } from 'react';

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="space-y-5 border-t border-[var(--muted)]/30 pt-5"
    >
      <h2 id={id} className="font-display text-2xl">
        {title}
      </h2>
      {children}
    </section>
  );
}
