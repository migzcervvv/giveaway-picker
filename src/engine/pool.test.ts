// @vitest-environment node
import { expect, test } from 'vitest';
import { eligiblePool, slotsFromResult } from './index';
import type { DrawEvent, Entrant } from './index';

const at = '2026-11-13T00:00:00.000Z';
function entrant(id: string): Entrant {
  return Object.freeze({ id, name: id, key: id });
}

const called = entrant('called');
const noShow = entrant('no-show');
const promoted = entrant('promoted');
const pending = entrant('pending');
const reserved = entrant('reserved');
const released = entrant('released');
const free = entrant('free');

const entrants = Object.freeze([
  free,
  released,
  called,
  noShow,
  promoted,
  reserved,
  pending,
]);
const draws: readonly (readonly DrawEvent[])[] = [
  [
    {
      id: 'draw1',
      at,
      type: 'DRAWN',
      slots: slotsFromResult({ winners: [noShow], backups: [promoted] }),
    },
    { id: 'absent', at, type: 'NO_SHOW', rank: 1 },
    { id: 'promote', at, type: 'PROMOTED', backupRank: 2, replacesRank: 1 },
  ],
  [
    {
      id: 'draw2',
      at,
      type: 'DRAWN',
      slots: slotsFromResult({ winners: [pending], backups: [reserved] }),
    },
  ],
  [
    {
      id: 'draw3',
      at,
      type: 'DRAWN',
      slots: slotsFromResult({ winners: [called], backups: [released] }),
    },
    { id: 'call', at, type: 'CALLED', rank: 1 },
  ],
];

test.each([
  [true, [free, released]],
  [false, [free, released, called]],
] as const)(
  'filters across open and resolved draws with removeCalled=%s',
  (removeCalled, expected) => {
    const events = Object.freeze(
      draws.map((draw) =>
        Object.freeze(draw.map((event) => Object.freeze(event))),
      ),
    );
    expect(eligiblePool(entrants, events, { removeCalled })).toEqual(expected);
    expect(eligiblePool(entrants, [], { removeCalled })).toEqual(entrants);
  },
);

test('an undo reopens a resolved draw and reserves its standby entrant again', () => {
  const events: DrawEvent[] = [
    {
      id: 'draw',
      at,
      type: 'DRAWN',
      slots: slotsFromResult({ winners: [called], backups: [released] }),
    },
    { id: 'call', at, type: 'CALLED', rank: 1 },
    { id: 'undo', at, type: 'UNDONE', targetEventId: 'call' },
  ];
  expect(eligiblePool(entrants, [events], { removeCalled: false })).toEqual([
    free,
    noShow,
    promoted,
    reserved,
    pending,
  ]);
});
