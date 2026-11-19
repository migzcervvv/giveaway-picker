import { applyAction, buildDrawRecord, slotsFromResult } from '@/engine';
import type { DrawEvent } from '@/engine';

export async function savedRecord({
  id = 'archive-a',
  createdAt = '2026-11-19T00:00:00Z',
  names = ['Alice', 'Bob', 'Carol', 'Dana', 'Unselected'],
  actions = false,
} = {}) {
  const entrants = names.map((name, index) => ({
    id: `e${index + 1}`,
    name,
    key: name.toLowerCase(),
  }));
  const result = {
    winners: entrants.slice(0, 2),
    backups: entrants.slice(2, 4),
  };
  const events: DrawEvent[] = [
    {
      id: `${id}-drawn`,
      at: createdAt,
      type: 'DRAWN',
      slots: slotsFromResult(result),
    },
  ];
  if (actions) {
    let sequence = 0;
    for (const action of [
      { type: 'CALLED', rank: 2 },
      { type: 'NO_SHOW', rank: 1 },
      { type: 'NO_SHOW', rank: 3 },
      { type: 'NO_SHOW', rank: 4 },
      { type: 'UNDO' },
    ] as const)
      events.push(
        ...applyAction(events, action, createdAt, () => `${id}-${++sequence}`),
      );
  }
  return buildDrawRecord({
    id,
    createdAt,
    entrants,
    result,
    events,
    buildStats: {
      rawCount: entrants.length,
      finalCount: entrants.length,
      blankDropped: 0,
      duplicatesRemoved: 0,
    },
    config: {
      winners: 2,
      backups: 2,
      dedupe: true,
      foldDiacritics: false,
      removeCalled: true,
    },
  });
}
