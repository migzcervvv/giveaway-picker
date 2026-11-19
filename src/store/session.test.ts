// @vitest-environment node
import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
import { afterEach, expect, test } from 'vitest';
import { createDrawRepository } from '@/db/repos';
import { DrawDatabase } from '@/db/schema';
import {
  applyAction,
  buildDrawRecord,
  buildEntrants,
  eligiblePool,
  slotsFromResult,
} from '@/engine';
import type { BuildResult, DrawEvent } from '@/engine';
import { createHistoryStore } from './history';
import { installLeaveGuard } from './leaveGuard';
import { createSessionStore } from './session';

const at = '2026-11-13T00:00:00.000Z';
const config = {
  winners: 1,
  backups: 1,
  dedupe: true,
  foldDiacritics: false,
  removeCalled: true,
};
const build = (...names: string[]) => buildEntrants(names, config);

function record(pool: BuildResult, id = 'draw') {
  const { entrants, stats } = pool;
  const result = {
    winners: entrants.slice(0, 1),
    backups: entrants.slice(1, 2),
  };
  return buildDrawRecord({
    id,
    createdAt: at,
    entrants,
    buildStats: stats,
    config,
    result,
    events: [
      { id: 'drawn', at, type: 'DRAWN', slots: slotsFromResult(result) },
    ],
  });
}

let sequence = 0;
const databases: DrawDatabase[] = [];
function database(name = `t06b-${++sequence}`) {
  const db = new DrawDatabase(name, { indexedDB, IDBKeyRange });
  databases.push(db);
  return db;
}
afterEach(async () => {
  for (const db of databases) db.close();
  for (const db of databases.splice(0)) await db.delete();
});

test.each([
  ['Carol', 'Dan'],
  ['Bob', 'Alice'],
])(
  'detaches old events and rejects stale work when rebuilding with %s and %s',
  async (first, second) => {
    const session = createSessionStore();
    const actions = session.getState();
    const oldPool = build('Alice', 'Bob');
    actions.setInput('Alice\nBob');
    actions.setBuild(oldPool, session.getState().generation);
    const { generation } = session.getState();
    const old = await record(oldPool);
    actions.setDraw(old, generation);

    expect(() => actions.setInput('new')).toThrow('Resolve');
    expect(() => actions.setBuild(oldPool, generation)).toThrow('Resolve');
    expect(() => actions.reset()).toThrow('Resolve');

    const events = [
      ...old.events,
      ...actions.prepareAction(
        old.id,
        { type: 'CALLED', rank: 1 },
        at,
        () => 'called',
      ),
    ];
    const repo = createDrawRepository(database());
    const closed = await repo.saveRecord({ ...old, events });
    actions.setDraw(closed, generation);
    const newPool = build(first, second);
    const newer = await record(newPool);
    if (first === 'Bob') expect(newer.listHash).toBe(old.listHash);
    expect(newPool.entrants.map(({ id }) => id)).toEqual(['e1', 'e2']);
    actions.setBuild(newPool, generation);
    expect(() => actions.setBuild(oldPool, generation)).toThrow('changed');
    expect(() => actions.setDraw(closed, generation)).toThrow('changed');

    const state = session.getState();
    expect(
      eligiblePool(
        newPool.entrants,
        state.draws.map(({ events }) => events),
        config,
      ),
    ).toEqual(newPool.entrants);
    expect(await repo.getRecord(old.id)).toEqual(closed);
    const reload = createSessionStore().getState();
    expect(reload).toMatchObject({ rawText: '', build: null, draws: [] });
    expect(() =>
      reload.prepareAction(old.id, { type: 'UNDO' }, at, () => 'undo'),
    ).toThrow('current pool');
    reload.setBuild(newPool, reload.generation);
    expect(() => reload.setDraw(closed, generation)).toThrow('changed');
  },
);

test('restricts undo to the latest draw and prepares actions without writing state or history', async () => {
  const pool = build('Alice', 'Bob');
  const older = await record(pool, 'older');
  const latest = {
    ...(await record(pool, 'latest')),
    createdAt: '2026-11-13T01:00:00.000Z',
  };
  const session = createSessionStore();
  const actions = session.getState();
  actions.setBuild(pool, actions.generation);
  const { generation } = session.getState();
  const call = { type: 'CALLED', rank: 1 } as const;
  const undo = { type: 'UNDO' } as const;
  const newId = () => 'action';
  const resolved = {
    ...latest,
    events: [...latest.events, ...applyAction(latest.events, call, at, newId)],
  };
  const repo = createDrawRepository(database());
  await repo.saveRecord(resolved);
  actions.setDraw(resolved, generation);
  actions.setDraw(older, generation);
  actions.setDraw(older, generation);
  const before = session.getState();
  expect(() => actions.prepareAction(older.id, undo, at, newId)).toThrow(
    'latest draw',
  );
  expect(actions.prepareAction(older.id, call, at, newId)[0]?.type).toBe(
    'CALLED',
  );
  expect(actions.prepareAction(latest.id, undo, at, () => 'undo')).toEqual([
    { type: 'UNDONE', targetEventId: 'action', id: 'undo', at },
  ]);
  expect(session.getState()).toBe(before);
  expect(await repo.getRecord(latest.id)).toEqual(resolved);
});

test('history reports typed and native failures and reloads only committed draws', async () => {
  const db = database();
  const draw = await record(build('Alice', 'Bob'));
  const history = createHistoryStore(createDrawRepository(db)).getState;
  const saving = history().save(draw);
  expect(history()).toMatchObject({ loading: true, records: [] });
  await saving;
  const called: DrawEvent = { type: 'CALLED', rank: 1, id: 'called', at };
  const saved = await history().append(draw.id, [called], 1);
  await expect(history().save(draw)).rejects.toMatchObject({
    name: 'ConstraintError',
  });
  expect(history()).toMatchObject({
    records: [saved],
    loading: false,
    error: { name: 'ConstraintError' },
  });
  await expect(history().append(draw.id, [], 1)).rejects.toMatchObject({
    code: 'STALE_COUNT',
  });
  expect(history()).toMatchObject({
    records: [saved],
    error: { code: 'STALE_COUNT' },
  });
  db.close();
  const reloaded = createHistoryStore(
    createDrawRepository(database(db.name)),
  ).getState;
  await reloaded().load();
  expect(reloaded().records).toEqual([saved]);
  await reloaded().remove(draw.id);
  expect(reloaded().records).toEqual([]);
  await reloaded().save(draw);
  await reloaded().clear();
  await reloaded().load();
  expect(reloaded()).toMatchObject({ records: [], error: null });
});

test('beforeunload tracks pending, promotion, resolution, undo and cleanup', async () => {
  const pool = build('Alice', 'Bob');
  const draw = await record(pool);
  const session = createSessionStore();
  const actions = session.getState();
  actions.setBuild(pool, actions.generation);
  const { generation } = session.getState();
  const target = new EventTarget();
  const cleanup = installLeaveGuard(target, session);
  function warns() {
    return !target.dispatchEvent(
      new Event('beforeunload', { cancelable: true }),
    );
  }
  expect(warns()).toBe(false);
  actions.setDraw(draw, generation);
  expect(warns()).toBe(true);
  let id = 0;
  function act(action: Parameters<typeof actions.prepareAction>[1]) {
    const [current] = session.getState().draws;
    if (!current) throw new Error('Expected current draw');
    const batch = actions.prepareAction(draw.id, action, at, () =>
      String(++id),
    );
    actions.setDraw(
      { ...current, events: [...current.events, ...batch] },
      generation,
    );
  }
  act({ type: 'CALLED', rank: 1 });
  expect(warns()).toBe(false);
  act({ type: 'UNDO' });
  expect(warns()).toBe(true);
  act({ type: 'NO_SHOW', rank: 1 });
  expect(warns()).toBe(true);
  act({ type: 'NO_SHOW', rank: 2 });
  expect(warns()).toBe(false);
  act({ type: 'UNDO' });
  expect(warns()).toBe(true);
  cleanup();
  expect(warns()).toBe(false);
});
