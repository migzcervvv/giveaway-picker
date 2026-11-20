// @vitest-environment node
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { DrawDatabase } from '@/db/schema';
import { createDrawRepository } from '@/db/repos';
import {
  buildEntrants,
  deriveState,
  draw,
  eligiblePool,
  hashEntrants,
  slotsFromResult,
} from '@/engine';
import { createDrawFlow } from './drawFlow';
import { createSessionStore } from './session';
import { createHistoryStore } from './history';
import { createSettingsStore } from './settings';
import { createDrawConfigStore } from './drawConfig';

let sequence = 0;
let db: DrawDatabase;
let repo: ReturnType<typeof createDrawRepository>;
let session: ReturnType<typeof createSessionStore>;
let history: ReturnType<typeof createHistoryStore>;
let settings: ReturnType<typeof createSettingsStore>;
let counts: ReturnType<typeof createDrawConfigStore>;
let flow: ReturnType<typeof createDrawFlow>;
const options = { dedupe: true, foldDiacritics: false };
const rng = { nextUint32: () => 0 };
const pool = buildEntrants(['Alice', 'Bob', 'Carol', 'Dana'], options);
const at = '2026-11-19T00:00:00Z';
function gate() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
beforeEach(() => {
  db = new DrawDatabase('t08-' + ++sequence, { indexedDB, IDBKeyRange });
  repo = createDrawRepository(db);
  session = createSessionStore();
  session.getState().setInput('Alice\nBob\nCarol\nDana');
  session.getState().setBuild(pool, session.getState().generation);
  history = createHistoryStore(repo);
  settings = createSettingsStore({
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  });
  counts = createDrawConfigStore();
  let id = 0;
  flow = createDrawFlow({
    session,
    history,
    settings,
    counts,
    rng,
    newId: () => 'id-' + ++id,
    now: () => at,
  });
});
afterEach(async () => {
  vi.restoreAllMocks();
  await db.delete();
});
function current() {
  const record = session
    .getState()
    .draws.find(({ id }) => id === flow.getState().activeId);
  if (!record) throw new Error('Expected selected draw');
  return record;
}
const eligible = () =>
  eligiblePool(
    pool.entrants,
    session.getState().draws.map(({ events }) => events),
    settings.getState(),
  );

test('draw is predetermined, hashed from the full list, and registered only after saving', async () => {
  counts.getState().setBackups(1, 4);
  const original = repo.saveRecord;
  const saving = vi
    .spyOn(repo, 'saveRecord')
    .mockImplementation(async (record) => {
      expect(session.getState().draws).toEqual([]);
      expect(flow.getState().activeId).toBeNull();
      return original(record);
    });
  await flow.getState().start(true);
  const selected = draw(pool.entrants, { winners: 1, backups: 1 }, rng);
  expect(current().slots).toEqual(slotsFromResult(selected));
  expect(current().listHash).toBe(await hashEntrants(pool.entrants));
  expect(current().config).toEqual({
    winners: 1,
    backups: 1,
    ...options,
    removeCalled: true,
  });
  expect(await repo.getRecord(current().id)).toEqual(current());
  expect(saving).toHaveBeenCalledTimes(1);
});

test('busy draw submissions are blocked; failed saves can retry without revealing or registering', async () => {
  const original = repo.saveRecord;
  const blocked = gate();
  const entered = gate();
  const saving = vi
    .spyOn(repo, 'saveRecord')
    .mockImplementationOnce(async () => {
      entered.release();
      await blocked.promise;
      throw new Error('Disk unavailable');
    });
  const pending = flow.getState().start(true);
  await entered.promise;
  await flow.getState().start(true);
  expect(flow.getState().busy).toBe(true);
  expect(saving).toHaveBeenCalledTimes(1);
  blocked.release();
  await pending;
  expect(flow.getState()).toMatchObject({
    activeId: null,
    error: 'Disk unavailable',
    busy: false,
  });
  expect(session.getState().draws).toEqual([]);
  saving.mockImplementation(original);
  await flow.getState().start(true);
  expect(flow.getState().error).toBeNull();
  expect(session.getState().draws).toHaveLength(1);
});

test('generation changes during hashing prevent persistence', async () => {
  const digest = crypto.subtle.digest.bind(crypto.subtle);
  const blocked = gate();
  vi.spyOn(crypto.subtle, 'digest').mockImplementation(async (...args) => {
    await blocked.promise;
    return digest(...args);
  });
  const pending = flow.getState().start(true);
  session.getState().reset();
  blocked.release();
  await pending;
  expect(await repo.listRecords()).toEqual([]);
  expect(session.getState().draws).toEqual([]);
  expect(flow.getState()).toMatchObject({
    activeId: null,
    error: 'The entrant pool changed',
  });
});

test('generation changes during persistence report a saved but detached record accurately', async () => {
  const original = repo.saveRecord;
  const blocked = gate(),
    committed = gate();
  vi.spyOn(repo, 'saveRecord').mockImplementation(async (record) => {
    const saved = await original(record);
    committed.release();
    await blocked.promise;
    return saved;
  });
  const pending = flow.getState().start(true);
  await committed.promise;
  session.getState().reset();
  blocked.release();
  await pending;
  expect(await repo.listRecords()).toHaveLength(1);
  expect(session.getState().draws).toEqual([]);
  expect(flow.getState().activeId).toBeNull();
  expect(flow.getState().error).toContain('Saved to history, but not attached');
});

test('rejects pending input and empty pools and clamps to the eligible pool', async () => {
  await flow.getState().start(false);
  expect(flow.getState().error).toContain('finish building');
  expect(await repo.listRecords()).toEqual([]);
  counts.getState().setWinners(4, 4);
  await flow.getState().start(true);
  expect(eligible()).toEqual([]);
  await flow.getState().start(true);
  expect(flow.getState().error).toBe('No eligible entrants remain');
  expect(await repo.listRecords()).toHaveLength(1);
});

test('actions preserve dependent events, reject stale appends, and undo only the latest draw', async () => {
  counts.getState().setBackups(1, 4);
  await flow.getState().start(true);
  const first = current();
  const original = repo.appendEvents;
  const appending = vi
    .spyOn(repo, 'appendEvents')
    .mockRejectedValueOnce(new Error('Append failed'));
  await flow.getState().act(first.id, { type: 'NO_SHOW', rank: 1 });
  expect(session.getState().draws[0]).toBe(first);
  expect(flow.getState().error).toBe('Append failed');
  await flow.getState().act(first.id, { type: 'NO_SHOW', rank: 1 });
  expect(appending).toHaveBeenLastCalledWith(
    first.id,
    expect.arrayContaining([
      expect.objectContaining({
        type: 'PROMOTED',
        backupRank: 2,
        replacesRank: 1,
      }),
    ]),
    1,
  );
  expect(
    deriveState(current().events).slots.map(({ status }) => status),
  ).toEqual(['no_show', 'promoted']);
  await flow.getState().act(first.id, { type: 'NO_SHOW', rank: 2 });
  expect(deriveState(current().events).exhausted).toEqual([2]);
  await flow.getState().act(first.id, { type: 'UNDO' });
  expect(deriveState(current().events).slots[1]?.status).toBe('promoted');
  await flow.getState().start(true);
  expect(flow.getState().canUndo(first.id)).toBe(false);
  const before = session.getState().draws;
  await flow.getState().act(first.id, { type: 'UNDO' });
  expect(session.getState().draws).toBe(before);
  const latest = current();
  await original(
    latest.id,
    [{ id: 'external', at, type: 'CALLED', rank: 1 }],
    1,
  );
  await flow.getState().act(latest.id, { type: 'CALLED', rank: 1 });
  expect(flow.getState().error).toBe('STALE_COUNT');
  expect(current()).toBe(latest);
});

test('real persisted multi-round eligibility honors every exclusion and fresh session boundaries', async () => {
  counts.getState().setBackups(1, 4);
  await flow.getState().start(true);
  const first = current();
  expect(eligible().map(({ name }) => name)).toEqual(['Carol', 'Dana']);
  await flow.getState().start(true);
  const second = current();
  expect(eligible()).toEqual([]);
  await flow.getState().act(first.id, { type: 'CALLED', rank: 1 });
  expect(eligible().map(({ name }) => name)).toEqual(['Bob']);
  await flow.getState().act(second.id, { type: 'NO_SHOW', rank: 1 });
  expect(eligible().map(({ name }) => name)).toEqual(['Bob']);
  await flow.getState().act(second.id, { type: 'CALLED', rank: 2 });
  settings.getState().update({ removeCalled: false });
  expect(eligible().map(({ name }) => name)).toEqual(['Alice', 'Bob', 'Dana']);
  counts.getState().setWinners(4, 4);
  await flow.getState().start(true);
  expect(current().config).toMatchObject({
    winners: 3,
    backups: 0,
    removeCalled: false,
  });
  expect(current().slots.map(({ name }) => name)).toEqual([
    'Alice',
    'Bob',
    'Dana',
  ]);
  expect(current().listHash).toBe(first.listHash);
  const fresh = createSessionStore();
  const next = buildEntrants(['Eve', 'Frank'], options);
  fresh.getState().setBuild(next, fresh.getState().generation);
  let id = 0;
  const reload = createDrawFlow({
    session: fresh,
    history,
    settings,
    counts,
    rng,
    newId: () => 'reload-' + ++id,
  });
  await reload.getState().start(true);
  expect(fresh.getState().draws[0]?.slots.map(({ name }) => name)).toEqual([
    'Eve',
    'Frank',
  ]);
  expect(await repo.listRecords()).toHaveLength(4);
});

test('overlapping winner actions are blocked until their persisted event batch commits', async () => {
  counts.getState().setBackups(1, 4);
  await flow.getState().start(true);
  const first = current();
  const waiting = gate();
  const original = repo.appendEvents;
  const append = vi
    .spyOn(repo, 'appendEvents')
    .mockImplementationOnce(async (...args) => {
      await waiting.promise;
      return original(...args);
    });
  const action = flow.getState().act(first.id, { type: 'NO_SHOW', rank: 1 });
  await flow.getState().act(first.id, { type: 'CALLED', rank: 1 });
  expect(current()).toBe(first);
  expect(flow.getState().busy).toBe(true);
  waiting.release();
  await action;
  expect(append).toHaveBeenCalledTimes(1);
  expect(current().events.map(({ type }) => type)).toEqual([
    'DRAWN',
    'NO_SHOW',
    'PROMOTED',
  ]);
  expect((await repo.getRecord(first.id))?.events).toEqual(current().events);
});

test('restart preserves exclusions, archive and identity of separate replacement', async () => {
  counts.getState().setWinners(2, 4);
  counts.getState().setBackups(1, 4);
  await flow.getState().start(true);
  const original = current();
  const gen = session.getState().generation;
  await flow.getState().act(original.id, { type: 'CALLED', rank: 1 });
  await flow.getState().act(original.id, { type: 'NO_SHOW', rank: 2 });
  await flow.getState().finish('restart', original.id, gen);
  expect((await repo.getRecord(original.id))?.events.at(-1)?.type).toBe(
    'CANCELLED',
  );
  expect(eligible().map((e) => e.name)).toEqual(['Carol', 'Dana']);
  settings.getState().update({ removeCalled: false });
  expect(eligible().map((e) => e.name)).toEqual(['Alice', 'Carol', 'Dana']);
  await flow.getState().start(true);
  expect(current().id).not.toBe(original.id);
  expect((await repo.listRecords()).length).toBe(2);
});
test('reset retries partial persistence once, keeps imported semantics and clears on request', async () => {
  session.getState().setInput('Doe, Jane\nBob', true);
  session
    .getState()
    .setBuild(
      buildEntrants(['Doe, Jane', 'Bob'], options),
      session.getState().generation,
    );
  await flow.getState().start(true);
  await flow.getState().start(true);
  const { generation } = session.getState();
  const id = current().id;
  const append = repo.appendEvents;
  const writes = vi
    .spyOn(repo, 'appendEvents')
    .mockImplementationOnce(append)
    .mockRejectedValueOnce(new Error('offline'));
  await flow.getState().finish('keep', id, generation);
  expect(session.getState().generation).toBe(generation);
  expect(
    (await repo.listRecords()).filter(
      (d) => d.events.at(-1)?.type === 'CANCELLED',
    ),
  ).toHaveLength(1);
  await Promise.all([
    flow.getState().finish('keep', id, generation),
    flow.getState().finish('keep', id, generation),
  ]);
  expect(writes).toHaveBeenCalledTimes(3);
  expect(session.getState()).toMatchObject({
    imported: true,
    rawText: 'Doe, Jane\nBob',
    draws: [],
  });
  expect(session.getState().build?.entrants[0]?.name).toBe('Doe, Jane');
  expect(
    (await repo.listRecords()).every(
      (d) => d.events.filter((e) => e.type === 'CANCELLED').length === 1,
    ),
  ).toBe(true);
  await flow.getState().finish('clear', null, session.getState().generation);
  expect(session.getState().rawText).toBe('');
});
test('completed and older draws reject restart', async () => {
  await flow.getState().start(true);
  const first = current().id;
  await flow.getState().start(true);
  const second = current().id;
  flow.getState().show(first);
  await flow.getState().finish('restart', first, session.getState().generation);
  expect(flow.getState().error).toBeTruthy();
  flow.getState().show(second);
  await flow.getState().act(second, { type: 'CALLED', rank: 1 });
  await flow
    .getState()
    .finish('restart', second, session.getState().generation);
  expect(flow.getState().error).toBeTruthy();
  expect(
    (await repo.listRecords())
      .flatMap((d) => d.events)
      .some((e) => e.type === 'CANCELLED'),
  ).toBe(false);
});
