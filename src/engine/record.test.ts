// @vitest-environment node
import { expect, test } from 'vitest';
import {
  applyAction,
  buildDrawRecord,
  buildEntrants,
  slotsFromResult,
  toExportJson,
  toExportRows,
} from './index';
import type { DrawEvent } from './index';

const createdAt = '2026-11-13T00:00:00.000Z';
const config = {
  winners: 1,
  backups: 1,
  dedupe: true,
  foldDiacritics: false,
  removeCalled: true,
};

function input() {
  const { entrants, stats: buildStats } = buildEntrants(
    ['Alice', 'Bob', 'Unselected Name', '', 'alice'],
    config,
  );
  const result = {
    winners: entrants.slice(0, 1),
    backups: entrants.slice(1, 2),
  };
  const events: DrawEvent[] = [
    {
      id: 'drawn',
      at: createdAt,
      type: 'DRAWN',
      slots: slotsFromResult(result),
    },
  ];
  let id = 0;
  events.push(
    ...applyAction(
      events,
      { type: 'NO_SHOW', rank: 1 },
      createdAt,
      () => `event-${++id}`,
    ),
  );
  return {
    id: 'draw-1',
    createdAt,
    config: { ...config },
    buildStats,
    entrants,
    result,
    events,
  };
}

test('stores counts and selected slots with no full entrant list anywhere in the record', async () => {
  const source = input();
  const record = await buildDrawRecord(source);

  function inspect(value: unknown) {
    if (typeof value === 'object' && value !== null) {
      for (const [key, child] of Object.entries(value)) {
        expect(key).not.toBe('entrants');
        inspect(child);
      }
    } else {
      expect(value).not.toBe('Unselected Name');
      expect(value).not.toBe('unselected name');
      expect(value).not.toBe('e3');
    }
  }

  inspect(record);
  expect(record).toMatchObject({
    entrantCount: 3,
    rawCount: 5,
    blankDropped: 1,
    duplicatesRemoved: 1,
  });
  expect(record.slots.map(({ name }) => name)).toEqual(['Alice', 'Bob']);
});

test('takes an immutable snapshot of config, result, counts, and nested events', async () => {
  const source = input();
  const before = structuredClone(source);
  const record = await buildDrawRecord(source);
  expect(source).toEqual(before);

  source.config.winners = 0;
  source.buildStats.rawCount = 0;
  source.result.winners.length = 0;
  const initial = source.events[0];
  if (initial?.type === 'DRAWN') initial.slots.length = 0;
  source.events.length = 0;

  expect(record).toEqual(await buildDrawRecord(before));
  expect(Object.isFrozen(record)).toBe(true);
  expect(Object.isFrozen(record.config)).toBe(true);
  expect(Object.isFrozen(record.slots[0])).toBe(true);
  const stored = record.events[0];
  expect(stored?.type).toBe('DRAWN');
  if (stored?.type === 'DRAWN') {
    expect(Object.isFrozen(stored.slots)).toBe(true);
    expect(Object.isFrozen(stored.slots[0])).toBe(true);
  }
});

test('exports stable schema 1 JSON with replayed statuses', async () => {
  const record = await buildDrawRecord(input());
  const json = toExportJson(record);
  const { removeCalled, ...rest } = record.config;
  const reordered = { ...record, config: { removeCalled, ...rest } };
  expect(toExportJson(reordered)).toBe(json);
  expect(json).toMatchSnapshot();
});

test('exports safe string cells for all formula triggers across slot, event, and summary rows', async () => {
  const source = input();
  source.id = '=summary';
  source.createdAt = '+date';
  const names = [
    '=formula',
    '+formula',
    '-formula',
    '@formula',
    '\tformula',
    '\rformula',
    'Normal',
  ];
  source.result.winners = names.map((name, i) => ({
    id: String(i),
    name,
    key: name,
  }));
  source.result.backups = [];
  source.events = [
    {
      id: '-event',
      at: '@date',
      type: 'DRAWN',
      slots: slotsFromResult(source.result),
    },
    {
      id: 'undo',
      at: source.createdAt,
      type: 'UNDONE',
      targetEventId: '\tcall',
    },
  ];
  const rows = toExportRows(await buildDrawRecord(source));

  expect(rows.slots.map(({ name }) => name)).toEqual([
    "'=formula",
    "'+formula",
    "'-formula",
    "'@formula",
    "'\tformula",
    "'\rformula",
    'Normal',
  ]);
  expect(rows.slots[0]).toEqual({
    rank: '1',
    role: 'winner',
    name: "'=formula",
    finalStatus: 'pending',
  });
  expect(rows.summary[0]).toMatchObject({
    drawId: "'=summary",
    createdAt: "'+date",
    rawCount: '5',
  });
  expect(rows.events[0]).toMatchObject({ id: "'-event", at: "'@date" });
  expect(rows.events[1]).toMatchObject({ targetEventId: "'\tcall" });

  const actual = toExportRows(await buildDrawRecord(input()));
  expect(actual.slots.map(({ finalStatus }) => finalStatus)).toEqual([
    'no_show',
    'promoted',
  ]);
  expect(actual.events[2]).toMatchObject({
    type: 'PROMOTED',
    backupRank: '2',
    replacesRank: '1',
  });
});
