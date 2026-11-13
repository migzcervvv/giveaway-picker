import type { DrawResult } from './types';

export type Slot = {
  rank: number;
  role: 'winner' | 'backup';
  entrantId: string;
  name: string;
};

export type DrawEvent = { id: string; at: string } & (
  | { type: 'DRAWN'; slots: Slot[] }
  | { type: 'CALLED'; rank: number }
  | { type: 'NO_SHOW'; rank: number }
  | { type: 'PROMOTED'; backupRank: number; replacesRank: number }
  | { type: 'EXHAUSTED'; replacesRank: number }
  | { type: 'UNDONE'; targetEventId: string }
);

export type SlotStatus =
  'pending' | 'called' | 'no_show' | 'standby' | 'promoted';
type DerivedSlot = Slot & { status: SlotStatus; replacedBy?: number };
type Action = { type: 'CALLED' | 'NO_SHOW'; rank: number } | { type: 'UNDO' };

class LifecycleError extends Error {
  constructor(public readonly code: 'INVALID_TRANSITION' | 'NOTHING_TO_UNDO') {
    super(code);
    this.name = 'LifecycleError';
  }
}

export function slotsFromResult({ winners, backups }: DrawResult): Slot[] {
  return [
    ...winners.map(({ id, name }, index): Slot => ({
      rank: index + 1,
      role: 'winner',
      entrantId: id,
      name,
    })),
    ...backups.map(({ id, name }, index): Slot => ({
      rank: winners.length + index + 1,
      role: 'backup',
      entrantId: id,
      name,
    })),
  ];
}

function undoneIds(events: readonly DrawEvent[]): Set<string> {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.type === 'UNDONE') ids.add(event.targetEventId);
  }
  return ids;
}

export function deriveState(events: readonly DrawEvent[]): {
  slots: DerivedSlot[];
  exhausted: number[];
} {
  const undone = undoneIds(events);
  const slots = new Map<number, DerivedSlot>();
  const exhausted: number[] = [];

  for (const [index, event] of events.entries()) {
    if (undone.has(event.id)) continue;

    switch (event.type) {
      case 'DRAWN':
        for (const slot of event.slots) {
          slots.set(slot.rank, {
            ...slot,
            status: slot.role === 'winner' ? 'pending' : 'standby',
          });
        }
        break;
      case 'CALLED':
      case 'NO_SHOW': {
        const slot = slots.get(event.rank);
        if (slot) slot.status = event.type === 'CALLED' ? 'called' : 'no_show';
        break;
      }
      case 'PROMOTED':
      case 'EXHAUSTED': {
        // A no-show and its consequence are appended together, in that order.
        const cause = events[index - 1];
        if (
          cause?.type === 'NO_SHOW' &&
          cause.rank === event.replacesRank &&
          undone.has(cause.id)
        )
          break;

        if (event.type === 'EXHAUSTED') {
          exhausted.push(event.replacesRank);
          break;
        }

        const backup = slots.get(event.backupRank);
        const replaced = slots.get(event.replacesRank);
        if (backup && replaced) {
          backup.status = 'promoted';
          replaced.replacedBy = backup.rank;
        }
        break;
      }
      case 'UNDONE':
        break;
    }
  }

  return { slots: [...slots.values()], exhausted };
}

export function applyAction(
  events: readonly DrawEvent[],
  action: Action,
  now: string,
  newId: () => string,
): DrawEvent[] {
  if (action.type === 'UNDO') {
    const undone = undoneIds(events);
    const target = [...events]
      .reverse()
      .find(
        (event) =>
          (event.type === 'CALLED' || event.type === 'NO_SHOW') &&
          !undone.has(event.id),
      );
    if (!target) throw new LifecycleError('NOTHING_TO_UNDO');
    return [{ id: newId(), at: now, type: 'UNDONE', targetEventId: target.id }];
  }

  const { slots } = deriveState(events);
  const slot = slots.find(({ rank }) => rank === action.rank);
  if (slot?.status !== 'pending' && slot?.status !== 'promoted') {
    throw new LifecycleError('INVALID_TRANSITION');
  }

  const event = { id: newId(), at: now, rank: slot.rank };
  if (action.type === 'CALLED') return [{ ...event, type: 'CALLED' }];

  let standby: DerivedSlot | undefined;
  for (const candidate of slots) {
    if (
      candidate.status === 'standby' &&
      (!standby || candidate.rank < standby.rank)
    ) {
      standby = candidate;
    }
  }

  const replacement = { id: newId(), at: now, replacesRank: slot.rank };
  return [
    { ...event, type: 'NO_SHOW' },
    standby
      ? { ...replacement, type: 'PROMOTED', backupRank: standby.rank }
      : { ...replacement, type: 'EXHAUSTED' },
  ];
}
