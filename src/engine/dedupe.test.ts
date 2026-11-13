// @vitest-environment node
import { expect, test } from 'vitest';
import { buildEntrants, splitPaste } from './index';

const dedupe = { dedupe: true, foldDiacritics: false };

test('keeps first display names in input order and reports removed occurrences', () => {
  const raw = Object.freeze([
    '  JOHN   Smith ',
    '',
    'Alex',
    'john smith',
    ' ALEX ',
    'John Smith',
    '\t\u00A0\u200B',
    'Zoe',
  ]);

  const result = buildEntrants(raw, dedupe);
  expect(result).toEqual({
    entrants: [
      { id: 'e1', name: 'JOHN Smith', key: 'john smith' },
      { id: 'e2', name: 'Alex', key: 'alex' },
      { id: 'e3', name: 'Zoe', key: 'zoe' },
    ],
    stats: {
      rawCount: 8,
      blankDropped: 2,
      duplicatesRemoved: 3,
      finalCount: 3,
    },
    duplicates: [
      { name: 'JOHN Smith', count: 2 },
      { name: 'Alex', count: 1 },
    ],
  });
  expect(buildEntrants(raw, dedupe)).toEqual(result);
});

test('can fold diacritics for deduplication', () => {
  const raw = ['José', 'Jose'];

  expect(buildEntrants(raw, dedupe).entrants.map(({ name }) => name)).toEqual(
    raw,
  );
  expect(buildEntrants(raw, { ...dedupe, foldDiacritics: true })).toEqual({
    entrants: [{ id: 'e1', name: 'José', key: 'jose' }],
    stats: {
      rawCount: 2,
      blankDropped: 0,
      duplicatesRemoved: 1,
      finalCount: 1,
    },
    duplicates: [{ name: 'José', count: 1 }],
  });
});

test('can keep duplicates with distinct IDs and no removals', () => {
  expect(
    buildEntrants(['Ada', '', 'ada', 'Ada'], { ...dedupe, dedupe: false }),
  ).toEqual({
    entrants: [
      { id: 'e1', name: 'Ada', key: 'ada' },
      { id: 'e2', name: 'ada', key: 'ada' },
      { id: 'e3', name: 'Ada', key: 'ada' },
    ],
    stats: {
      rawCount: 4,
      blankDropped: 1,
      duplicatesRemoved: 0,
      finalCount: 3,
    },
    duplicates: [],
  });
});

test('counts blank paste rows and fields before dropping them', () => {
  expect(buildEntrants(splitPaste('Ada,,Bob,'), dedupe).stats).toEqual({
    rawCount: 4,
    blankDropped: 2,
    duplicatesRemoved: 0,
    finalCount: 2,
  });
});

test('conserves counts for every input up to four names from a varied alphabet', () => {
  const alphabet = ['', '\u200B\t', 'Ada', ' ADA ', 'José', 'Jose', 'Ａｄａ'];
  let inputs: string[][] = [[]];

  for (let length = 0; length <= 4; length++) {
    for (const input of inputs) {
      for (const foldDiacritics of [false, true]) {
        const { stats } = buildEntrants(input, {
          dedupe: true,
          foldDiacritics,
        });
        expect(stats.rawCount).toBe(input.length);
        expect(
          stats.finalCount + stats.duplicatesRemoved + stats.blankDropped,
        ).toBe(stats.rawCount);
      }
    }
    if (length < 4) {
      inputs = inputs.flatMap((input) =>
        alphabet.map((name) => [...input, name]),
      );
    }
  }
});

test('builds 100,000 names with 30% duplicates in under 500 ms', () => {
  const names = Array.from(
    { length: 100_000 },
    (_, i) => `Entrant ${i % 70_000}`,
  );

  const start = performance.now();
  const result = buildEntrants(names, dedupe);
  const duration = performance.now() - start;

  expect(duration).toBeLessThan(500);
  expect(result.stats).toEqual({
    rawCount: 100_000,
    blankDropped: 0,
    duplicatesRemoved: 30_000,
    finalCount: 70_000,
  });
  expect(result.duplicates).toHaveLength(30_000);
});
