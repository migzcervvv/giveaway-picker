// @vitest-environment node
import { expect, test } from 'vitest';
import {
  applyAction,
  buildDrawRecord,
  buildEntrants,
  slotsFromResult,
} from '@/engine';
import { createSessionStore } from './session';

test('replacement accepts exact extensions and rejects rewritten identity, prefix, or truncation', async () => {
  const config = {
    winners: 1,
    backups: 0,
    dedupe: true,
    foldDiacritics: false,
    removeCalled: true,
  };
  const build = buildEntrants(['Alice'], config);
  const result = { winners: build.entrants, backups: [] };
  const at = '2026-11-19T00:00:00Z';
  const record = await buildDrawRecord({
    id: 'draw',
    createdAt: at,
    config,
    buildStats: build.stats,
    entrants: build.entrants,
    result,
    events: [
      { id: 'drawn', at, type: 'DRAWN', slots: slotsFromResult(result) },
    ],
  });
  const session = createSessionStore();
  session.getState().setBuild(build, session.getState().generation);
  const { generation, setDraw } = session.getState();
  setDraw(record, generation);
  const extension = {
    ...record,
    events: [
      ...record.events,
      ...applyAction(
        record.events,
        { type: 'CALLED', rank: 1 },
        at,
        () => 'call',
      ),
    ],
  };
  setDraw(extension, generation);
  expect(session.getState().draws).toEqual([extension]);
  for (const invalid of [
    record,
    { ...extension, createdAt: 'different' },
    { ...extension, listHash: 'different' },
    { ...extension, config: { ...config, winners: 2 } },
    { ...extension, rawCount: 99 },
    {
      ...extension,
      slots: extension.slots.map((slot) => ({ ...slot, name: 'Changed' })),
    },
    {
      ...extension,
      events: extension.events.map((event) => ({ ...event, id: 'Changed' })),
    },
  ]) {
    expect(() => setDraw(invalid, generation)).toThrow('preserve its identity');
    expect(session.getState().draws).toEqual([extension]);
  }
  const clone = structuredClone(extension);
  setDraw(clone, generation);
  expect(session.getState().draws).toEqual([clone]);
  expect(session.getState().generation).toBe(generation);
});
