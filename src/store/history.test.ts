// @vitest-environment node
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { DrawDatabase } from '@/db/schema';
import { createDrawRepository } from '@/db/repos';
import { savedRecord } from '@/io/export/test-utils';
import { createHistoryStore } from './history';

let db: DrawDatabase;
let sequence = 0;
beforeEach(() => {
  db = new DrawDatabase('t09-queue-' + ++sequence, { indexedDB, IDBKeyRange });
});
afterEach(async () => {
  vi.restoreAllMocks();
  await db.delete();
});
test('three sequential saves and a fresh load agree on timestamp order and ID ties', async () => {
  const repo = createDrawRepository(db);
  const history = createHistoryStore(repo);
  for (const config of [
    { id: 'b', createdAt: '2026-11-19T00:00:00Z' },
    { id: 'a', createdAt: '2026-11-19T00:00:00Z' },
    { id: 'c', createdAt: '2026-11-20T00:00:00Z' },
  ])
    await history.getState().save(await savedRecord(config));
  const fresh = createHistoryStore(repo);
  await fresh.getState().load();
  expect(fresh.getState().records.map(({ id }) => id)).toEqual(['c', 'a', 'b']);
  expect(fresh.getState().records).toEqual(history.getState().records);
});
test('overlapping queue operations commit in order and loading stays true until the queue drains', async () => {
  const repo = createDrawRepository(db);
  const history = createHistoryStore(repo);
  const original = repo.saveRecord;
  let release: () => void = () => {};
  const gate = new Promise<void>((done) => {
    release = done;
  });
  vi.spyOn(repo, 'saveRecord').mockImplementationOnce(async (record) => {
    await gate;
    return original(record);
  });
  const record = await savedRecord();
  const first = history.getState().save(record);
  const clear = history.getState().clear();
  const last = history.getState().save(await savedRecord({ id: 'last' }));
  expect(history.getState().loading).toBe(true);
  expect(history.getState().records).toEqual([]);
  release();
  await first;
  expect(history.getState().loading).toBe(true);
  await clear;
  expect(history.getState().loading).toBe(true);
  await last;
  expect(history.getState().loading).toBe(false);
  expect(history.getState().records.map(({ id }) => id)).toEqual(['last']);
  expect(await repo.listRecords()).toEqual(history.getState().records);
});
