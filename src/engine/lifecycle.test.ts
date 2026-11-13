// @vitest-environment node
import { expect, test } from 'vitest';
import { applyAction, deriveState, slotsFromResult } from './index';
import type { DrawEvent } from './index';

const at = '2026-11-13T00:00:00.000Z';
const entrant = (id: string) => Object.freeze({ id, name: id, key: id });
const slots = slotsFromResult({
  winners: [entrant('A'), entrant('B')],
  backups: [entrant('C'), entrant('D'), entrant('E')],
});
const drawn = { id: 'draw', at, type: 'DRAWN', slots } satisfies DrawEvent;

function append(
  events: readonly DrawEvent[],
  action: Parameters<typeof applyAction>[1],
) {
  let id = events.length;
  return applyAction(events, action, at, () => `event-${++id}`);
}

test('creates global ranks in draw order and derives the initial statuses', () => {
  expect(slots).toEqual([
    { rank: 1, role: 'winner', entrantId: 'A', name: 'A' },
    { rank: 2, role: 'winner', entrantId: 'B', name: 'B' },
    { rank: 3, role: 'backup', entrantId: 'C', name: 'C' },
    { rank: 4, role: 'backup', entrantId: 'D', name: 'D' },
    { rank: 5, role: 'backup', entrantId: 'E', name: 'E' },
  ]);
  expect(deriveState([drawn]).slots.map(({ status }) => status)).toEqual([
    'pending',
    'pending',
    'standby',
    'standby',
    'standby',
  ]);
  expect(deriveState([])).toEqual({ slots: [], exhausted: [] });
});

test.each([
  [2, 'CALLED', 'called'],
  [2, 'NO_SHOW', 'no_show'],
  [3, 'CALLED', 'called'],
  [3, 'NO_SHOW', 'no_show'],
  [1, 'CALLED', null],
  [1, 'NO_SHOW', null],
  [4, 'CALLED', null],
  [4, 'NO_SHOW', null],
  [6, 'CALLED', null],
  [6, 'NO_SHOW', null],
] as const)(
  'applies rank %i %s with expected status %s',
  (rank, type, expected) => {
    const events = [drawn, ...append([drawn], { type: 'NO_SHOW', rank: 1 })];
    const action = { type, rank };
    if (expected === null) {
      expect(() => append(events, action)).toThrow(
        expect.objectContaining({
          name: 'LifecycleError',
          code: 'INVALID_TRANSITION',
        }),
      );
    } else {
      const state = deriveState([...events, ...append(events, action)]);
      expect(state.slots.find((slot) => slot.rank === rank)?.status).toBe(
        expected,
      );
    }
  },
);

test.each(['CALLED', 'NO_SHOW'] as const)(
  'rejects %s on a called slot',
  (type) => {
    const events = [drawn, ...append([drawn], { type: 'CALLED', rank: 1 })];
    expect(() => append(events, { type, rank: 1 })).toThrow(
      'INVALID_TRANSITION',
    );
  },
);

test('promotes all three backups in rank order, then exhausts the chain', () => {
  const events: DrawEvent[] = [{ ...drawn, slots: [...slots].reverse() }];
  const steps = [
    [1, 3, ['no_show', 'pending', 'promoted', 'standby', 'standby']],
    [2, 4, ['no_show', 'no_show', 'promoted', 'promoted', 'standby']],
    [3, 5, ['no_show', 'no_show', 'no_show', 'promoted', 'promoted']],
    [5, undefined, ['no_show', 'no_show', 'no_show', 'promoted', 'no_show']],
  ] as const;
  for (const [rank, backupRank, statuses] of steps) {
    const entries = append(events, { type: 'NO_SHOW', rank });
    expect(entries.map(({ type }) => type)).toEqual([
      'NO_SHOW',
      backupRank === undefined ? 'EXHAUSTED' : 'PROMOTED',
    ]);
    events.push(...entries);
    const state = deriveState(events);
    expect([...state.slots].reverse().map(({ status }) => status)).toEqual(
      statuses,
    );
    expect(state.slots.find((slot) => slot.rank === rank)?.replacedBy).toBe(
      backupRank,
    );
    expect(state.exhausted).toEqual(backupRank === undefined ? [rank] : []);
  }

  events.push(...append(events, { type: 'UNDO' }));
  expect(deriveState(events).exhausted).toEqual([]);
  expect(deriveState(events).slots.find(({ rank }) => rank === 5)?.status).toBe(
    'promoted',
  );
});

test('undo restores both slots, skips older undo markers, and supports a repeated no-show', () => {
  const events: DrawEvent[] = [drawn];
  events.push(...append(events, { type: 'NO_SHOW', rank: 1 }));
  const promoted = deriveState(events);
  events.push(...append(events, { type: 'CALLED', rank: 3 }));
  events.push(...append(events, { type: 'UNDO' }));
  expect(deriveState(events)).toEqual(promoted);
  events.push(...append(events, { type: 'UNDO' }));
  expect(deriveState(events)).toEqual(deriveState([drawn]));
  expect(() => append(events, { type: 'UNDO' })).toThrow(
    expect.objectContaining({
      name: 'LifecycleError',
      code: 'NOTHING_TO_UNDO',
    }),
  );
  events.push(...append(events, { type: 'NO_SHOW', rank: 1 }));
  expect(deriveState(events)).toEqual(promoted);
});

test('replays deterministically without mutating frozen events or slots', () => {
  const initial = Object.freeze({
    ...drawn,
    slots: slots.map((slot) => Object.freeze({ ...slot })),
  });
  Object.freeze(initial.slots);
  const action = { type: 'NO_SHOW', rank: 1 } as const;
  const entries = append([initial], action);
  expect(entries).toEqual(append([initial], action));
  expect(entries).toEqual([
    { id: 'event-2', at, type: 'NO_SHOW', rank: 1 },
    { id: 'event-3', at, type: 'PROMOTED', backupRank: 3, replacesRank: 1 },
  ]);

  const events = Object.freeze([
    initial,
    ...entries.map((event) => Object.freeze(event)),
  ]);
  const first = deriveState(events);
  expect(deriveState(events)).toEqual(first);
  expect(first.slots[0]).not.toBe(initial.slots[0]);
  expect(initial.slots[0]).toEqual(slots[0]);
});
