import { useId } from 'react';
import type { ReactNode } from 'react';

export function Section({
  title,
  children,
  step,
}: {
  title: string;
  step?: number;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="panel space-y-4">
      <h2 id={id} className="panel-title">
        {step && (
          <span className="step" aria-hidden="true">
            {step}
          </span>
        )}
        {title}
      </h2>
      {children}
    </section>
  );
}
