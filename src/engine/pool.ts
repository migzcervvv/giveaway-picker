import { deriveState } from './lifecycle';
import type { DrawEvent } from './lifecycle';
import type { Entrant } from './types';

export function eligiblePool(
  allEntrants: readonly Entrant[],
  drawsEvents: readonly (readonly DrawEvent[])[],
  { removeCalled }: { removeCalled: boolean },
): Entrant[] {
  const excluded = new Set<string>();

  for (const events of drawsEvents) {
    const { slots } = deriveState(events);
    const isOpen = slots.some(
      ({ status }) => status === 'pending' || status === 'promoted',
    );

    for (const { entrantId, status } of slots) {
      if (
        status === 'no_show' ||
        (status === 'called' && removeCalled) ||
        status === 'pending' ||
        status === 'promoted' ||
        (status === 'standby' && isOpen)
      ) {
        excluded.add(entrantId);
      }
    }
  }

  return allEntrants.filter(({ id }) => !excluded.has(id));
}
