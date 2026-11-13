// @vitest-environment node
import { expect, test, vi } from 'vitest';
import { DrawConfigError, buildEntrants, draw } from './index';
import { seededSource } from './test-utils';

const pool = Object.freeze(
  buildEntrants(['Ada', 'Renée', '李', 'Ada'], {
    dedupe: false,
    foldDiacritics: false,
  }).entrants.map((entrant) => Object.freeze(entrant)),
);

test('reproduces a draw from the same seed and leaves the pool intact', () => {
  const cfg = { winners: 2, backups: 1 };
  const first = draw(pool, cfg, seededSource(42));

  expect(first).toEqual(draw(pool, cfg, seededSource(42)));
  expect(first.winners).toHaveLength(2);
  expect(first.backups).toHaveLength(1);
  expect(
    new Set([...first.winners, ...first.backups].map(({ id }) => id)).size,
  ).toBe(3);
  expect(pool.map(({ id }) => id)).toEqual(['e1', 'e2', 'e3', 'e4']);
});

test('keeps selection order across winners and backups when the draw fills the pool', () => {
  const result = draw(
    pool,
    { winners: 2, backups: 2 },
    { nextUint32: () => 2 },
  );

  expect(result.winners.map(({ id }) => id)).toEqual(['e3', 'e4']);
  expect(result.backups.map(({ id }) => id)).toEqual(['e1', 'e2']);
});

test('can draw the entire pool as winners', () => {
  const result = draw(
    pool,
    { winners: pool.length, backups: 0 },
    seededSource(42),
  );

  expect(result.winners).toHaveLength(pool.length);
  expect(new Set(result.winners)).toEqual(new Set(pool));
  expect(result.backups).toEqual([]);
});

test('uses the default secure source for a single-entrant draw', () => {
  const single = pool.slice(0, 1);

  expect(draw(single, { winners: 1, backups: 0 })).toEqual({
    winners: single,
    backups: [],
  });
});

test.each([
  [pool, { winners: 0, backups: 0 }, 'WINNERS_MIN'],
  [pool, { winners: -1, backups: 0 }, 'WINNERS_MIN'],
  [pool, { winners: 1.5, backups: 0 }, 'WINNERS_MIN'],
  [pool, { winners: NaN, backups: 0 }, 'WINNERS_MIN'],
  [pool, { winners: 1, backups: -1 }, 'BACKUPS_NEG'],
  [pool, { winners: 1, backups: 0.5 }, 'BACKUPS_NEG'],
  [pool, { winners: 1, backups: Infinity }, 'BACKUPS_NEG'],
  [[], { winners: 1, backups: 0 }, 'EMPTY_POOL'],
  [pool, { winners: pool.length, backups: 1 }, 'EXCEEDS_POOL'],
] as const)('rejects invalid draws (%j, %j) as %s', (entrants, cfg, code) => {
  const nextUint32 = vi.fn(() => 0);

  expect(() => draw(entrants, cfg, { nextUint32 })).toThrow(
    expect.objectContaining({ code, constructor: DrawConfigError }),
  );
  expect(nextUint32).not.toHaveBeenCalled();
});
