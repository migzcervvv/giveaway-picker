// @vitest-environment node
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { buildDrawRecord, buildEntrants, slotsFromResult } from '@/engine';
import type { DrawEvent, DrawRecord } from '@/engine';
import { createDrawRepository } from './repos';
import { DrawDatabase } from './schema';

const at = '2026-11-13T00:00:00.000Z';
const secret = 'Unselected entrant';
let sequence = 0;
let db: DrawDatabase;
let repo: ReturnType<typeof createDrawRepository>;
let record: DrawRecord;

function open(name: string) {
  return new DrawDatabase(name, { indexedDB, IDBKeyRange });
}

beforeEach(async () => {
  db = open(`t06a-${++sequence}`);
  repo = createDrawRepository(db);
  const config = {
    winners: 1,
    backups: 1,
    dedupe: true,
    foldDiacritics: false,
    removeCalled: true,
  };
  const { entrants, stats } = buildEntrants(['Alice', 'Bob', secret], config);
  const result = {
    winners: entrants.slice(0, 1),
    backups: entrants.slice(1, 2),
  };
  record = await buildDrawRecord({
    id: 'draw',
    createdAt: at,
    entrants,
    buildStats: stats,
    config,
    result,
    events: [
      { id: 'drawn', at, type: 'DRAWN', slots: slotsFromResult(result) },
    ],
  });
});

afterEach(async () => {
  await db.delete();
});

const call = (id: string): DrawEvent => ({ id, at, type: 'CALLED', rank: 1 });

test('round-trips and reopens history, orders timestamp ties, and deletes records', async () => {
  await repo.saveRecord(record);
  await repo.saveRecord({ ...record, id: 'a' });
  await repo.saveRecord({
    ...record,
    id: 'new',
    createdAt: '2026-11-14T00:00:00.000Z',
  });
  db.close();
  db = open(db.name);
  repo = createDrawRepository(db);

  const saved = await repo.getRecord(record.id);
  expect(saved).toEqual(record);
  Reflect.set(saved?.slots[0] ?? {}, 'name', 'Changed');
  expect(await repo.getRecord(record.id)).toEqual(record);
  expect((await repo.listRecords()).map(({ id }) => id)).toEqual([
    'new',
    'a',
    'draw',
  ]);
  await repo.deleteRecord('a');
  expect(await repo.getRecord('a')).toBeUndefined();
  expect(await repo.listRecords()).toHaveLength(2);
  await repo.clearRecords();
  expect(await repo.listRecords()).toEqual([]);
});

test('drops nested unexpected data at both write boundaries without mutating inputs', async () => {
  const extra = { rawText: secret, entrants: [{ name: secret }] };
  const slots = record.slots.map((slot) => ({ ...slot, ...extra }));
  const crafted = {
    ...record,
    ...extra,
    slots,
    config: { ...record.config, ...extra },
    events: [{ ...extra, id: 'drawn', at, type: 'DRAWN' as const, slots }],
  };
  const original = structuredClone(crafted);
  await repo.saveRecord(crafted);
  expect(crafted).toEqual(original);
  expect(await db.draws.get(record.id)).toEqual(record);
  const appended = { ...call('called'), ...extra };
  await repo.appendEvents(record.id, [appended], 1);

  function inspect(value: unknown) {
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        expect(['rawText', 'entrants']).not.toContain(key);
        inspect(child);
      }
    } else {
      expect(value).not.toBe(secret);
    }
  }
  const stored = await db.draws.get(record.id);
  inspect(stored);
  expect(stored).toEqual({
    ...record,
    events: [...record.events, call('called')],
  });
});

test('rejects invalid initial metadata and duplicate event IDs without writes', async () => {
  const malformed = structuredClone(record);
  Reflect.set(malformed.slots[0] ?? {}, 'name', { rawText: secret });
  await expect(repo.saveRecord(malformed)).rejects.toMatchObject({
    code: 'INVALID_RECORD',
  });
  const mismatched = record.slots.map((slot) => ({ ...slot, name: secret }));
  for (const events of [
    [],
    [call('first')],
    [{ id: 'drawn', at, type: 'DRAWN' as const, slots: mismatched }],
    [
      {
        id: 'drawn',
        at,
        type: 'DRAWN' as const,
        slots: [...record.slots].reverse(),
      },
    ],
  ]) {
    await expect(repo.saveRecord({ ...record, events })).rejects.toMatchObject({
      code: 'INVALID_RECORD',
    });
  }
  await expect(
    repo.saveRecord({ ...record, events: [...record.events, call('drawn')] }),
  ).rejects.toMatchObject({ code: 'DUPLICATE_EVENT' });
  expect(await db.draws.count()).toBe(0);
});

test('duplicate saves cannot overwrite the original record or its appended events', async () => {
  await repo.saveRecord(record);
  const current = await repo.appendEvents(record.id, [call('called')], 1);
  await expect(repo.saveRecord(record)).rejects.toMatchObject({
    name: 'ConstraintError',
  });
  expect(await repo.getRecord(record.id)).toEqual(current);
});

test('rejects invalid append batches without committing any event', async () => {
  await expect(repo.appendEvents(record.id, [], 0)).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
  await repo.saveRecord(record);
  const first = call('first');
  const drawn: DrawEvent = {
    id: 'new-drawn',
    at,
    type: 'DRAWN',
    slots: [...record.slots],
  };

  await expect(repo.appendEvents(record.id, [], 0)).rejects.toMatchObject({
    code: 'STALE_COUNT',
  });
  await expect(
    repo.appendEvents(record.id, [first, call('drawn')], 1),
  ).rejects.toMatchObject({ code: 'DUPLICATE_EVENT' });
  await expect(
    repo.appendEvents(record.id, [first, first], 1),
  ).rejects.toMatchObject({ code: 'DUPLICATE_EVENT' });
  await expect(
    repo.appendEvents(record.id, [first, drawn], 1),
  ).rejects.toMatchObject({ code: 'UNEXPECTED_DRAWN' });
  expect(await repo.appendEvents(record.id, [], 1)).toEqual(record);
  expect(await db.draws.get(record.id)).toEqual(record);
});

test('only one concurrent append at the same count commits, preserving batch order', async () => {
  await repo.saveRecord(record);
  const batches = [
    [call('call-a'), call('call-b')],
    [call('call-c'), call('call-d')],
  ];
  const outcomes = await Promise.allSettled(
    batches.map((batch) => repo.appendEvents(record.id, batch, 1)),
  );
  expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(
    1,
  );
  expect(outcomes.filter(({ status }) => status === 'rejected')).toEqual([
    {
      status: 'rejected',
      reason: expect.objectContaining({ code: 'STALE_COUNT' }),
    },
  ]);
  const winner = outcomes.findIndex(({ status }) => status === 'fulfilled');
  expect((await repo.getRecord(record.id))?.events).toEqual([
    ...record.events,
    ...(batches[winner] ?? []),
  ]);
});
