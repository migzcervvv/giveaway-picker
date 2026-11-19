// @vitest-environment node
import { expect, test } from 'vitest';
import {
  applyAction,
  buildDrawRecord,
  buildEntrants,
  slotsFromResult,
} from '@/engine';
import { createSessionStore } from './session';

const at = '2026-11-19T10:00:00Z';
const config = {
  winners: 1,
  backups: 0,
  dedupe: true,
  foldDiacritics: false,
  removeCalled: true,
};
const pool = buildEntrants(['Alice', 'Bob'], config);
async function record(id: string, createdAt: string, called = true) {
  const result = { winners: pool.entrants.slice(0, 1), backups: [] };
  const events = [
    { id: 'drawn', at, type: 'DRAWN' as const, slots: slotsFromResult(result) },
  ];
  const draw = await buildDrawRecord({
    id,
    createdAt,
    config,
    entrants: pool.entrants,
    buildStats: pool.stats,
    result,
    events,
  });
  return called
    ? {
        ...draw,
        events: [
          ...events,
          ...applyAction(
            events,
            { type: 'CALLED', rank: 1 },
            at,
            () => 'called',
          ),
        ],
      }
    : draw;
}

test.each(['2026-11-19T09:59:00Z', at, '2026-11-19T10:01:00Z'])(
  'undo follows registration order when the second draw has timestamp %s',
  async (timestamp) => {
    const session = createSessionStore();
    session.getState().setBuild(pool, session.getState().generation);
    const { generation, setDraw, prepareAction } = session.getState();
    const first = await record('first', at);
    const second = await record('second', timestamp);
    setDraw(first, generation);
    setDraw(second, generation);

    for (const replacement of [
      { ...first, createdAt: '2026-11-19T11:00:00Z' },
      { ...second, createdAt: '2026-11-19T08:00:00Z' },
    ]) {
      const before = session.getState().draws;
      expect(() => setDraw(replacement, generation)).toThrow(
        'preserve its identity',
      );
      const original = replacement.id === first.id ? first : second;
      const refreshed = { ...original };
      setDraw(refreshed, generation);
      expect(before.map(({ id }) => id)).toEqual(['first', 'second']);
      expect(session.getState().draws.map(({ id }) => id)).toEqual([
        'first',
        'second',
      ]);
      expect(
        session.getState().draws.find(({ id }) => id === replacement.id),
      ).toBe(refreshed);
      expect(session.getState().generation).toBe(generation);
      const snapshot = session.getState();
      expect(() =>
        prepareAction('first', { type: 'UNDO' }, at, () => 'undo'),
      ).toThrow('latest draw');
      expect(
        prepareAction('second', { type: 'UNDO' }, at, () => 'undo'),
      ).toEqual([{ id: 'undo', at, type: 'UNDONE', targetEventId: 'called' }]);
      expect(session.getState()).toBe(snapshot);
    }

    session.getState().reset();
    expect(session.getState().draws).toEqual([]);
    session.getState().setBuild(pool, session.getState().generation);
    expect(() => setDraw(second, generation)).toThrow('changed');
    expect(() =>
      prepareAction('second', { type: 'UNDO' }, at, () => 'undo'),
    ).toThrow('current pool');
    const fresh = await record('first', timestamp);
    setDraw(fresh, session.getState().generation);
    expect(
      prepareAction('first', { type: 'UNDO' }, at, () => 'undo')[0]?.type,
    ).toBe('UNDONE');

    const reload = createSessionStore();
    reload.getState().setBuild(pool, reload.getState().generation);
    expect(() =>
      reload.getState().setDraw(fresh, session.getState().generation),
    ).toThrow('changed');
    expect(() =>
      reload
        .getState()
        .prepareAction('first', { type: 'UNDO' }, at, () => 'undo'),
    ).toThrow('current pool');
  },
);

test.each(['CALLED', 'NO_SHOW'] as const)(
  'earlier pending draws still allow %s',
  async (type) => {
    const session = createSessionStore();
    session.getState().setBuild(pool, session.getState().generation);
    const { setDraw, generation, prepareAction } = session.getState();
    const first = await record('first', at, false);
    setDraw(first, generation);
    setDraw(await record('second', '2026-11-19T09:59:00Z'), generation);
    const snapshot = session.getState();
    expect(
      prepareAction('first', { type, rank: 1 }, at, () => 'action')[0],
    ).toEqual({
      id: 'action',
      at,
      type,
      rank: 1,
    });
    expect(session.getState()).toBe(snapshot);
  },
);
