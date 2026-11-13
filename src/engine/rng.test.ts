// @vitest-environment node
import { expect, test, vi } from 'vitest';
import { cryptoSource, partialShuffle, randomFloat, uniformInt } from './index';
import { seededSource } from './test-utils';

const uint32Range = 2 ** 32;

test('rejects samples at and above the limit before accepting one', () => {
  const limit = uint32Range - (uint32Range % 7);
  const nextUint32 = vi
    .fn<() => number>()
    .mockReturnValueOnce(limit)
    .mockReturnValueOnce(uint32Range - 1)
    .mockReturnValueOnce(limit - 1)
    .mockImplementation(() => {
      throw new Error('The accepted value should end sampling');
    });

  expect(uniformInt(7, { nextUint32 })).toBe(6);
  expect(nextUint32).toHaveBeenCalledTimes(3);
});

test.each([-1, 0, 1.5, NaN, Infinity, uint32Range + 1])(
  'rejects invalid upper bound %s without consuming randomness',
  (maxExclusive) => {
    const nextUint32 = vi.fn(() => 0);
    expect(() => uniformInt(maxExclusive, { nextUint32 })).toThrow(RangeError);
    expect(nextUint32).not.toHaveBeenCalled();
  },
);

test('accepts both ends of the supported range', () => {
  const rng = { nextUint32: () => uint32Range - 1 };
  expect(uniformInt(1, rng)).toBe(0);
  expect(uniformInt(uint32Range, rng)).toBe(uint32Range - 1);
});

test('secure sampling is uniform across seven buckets', () => {
  const draws = 200_000;
  const buckets = new Uint32Array(7);

  for (let i = 0; i < draws; i++) {
    const bucket = uniformInt(7, cryptoSource);
    // The sampler returns an index in [0, 7).
    buckets[bucket] = buckets[bucket]! + 1;
  }

  expect(buckets.reduce((sum, count) => sum + count, 0)).toBe(draws);
  const expected = draws / buckets.length;
  const chiSquare = buckets.reduce(
    (sum, count) => sum + (count - expected) ** 2 / expected,
    0,
  );
  // With six degrees of freedom, the upper-tail probability at 40 is about 4.6e-7.
  expect(chiSquare).toBeLessThan(40);
});

test('samples each of six permutations within 5% of its expected frequency', () => {
  const rng = seededSource(0x12345678);
  const permutations = new Map<string, number>();
  const runs = 60_000;

  for (let i = 0; i < runs; i++) {
    const permutation = partialShuffle(['a', 'b', 'c'], 3, rng).join('');
    permutations.set(permutation, (permutations.get(permutation) ?? 0) + 1);
  }

  const expected = runs / 6;
  expect(permutations.size).toBe(6);
  for (const permutation of ['abc', 'acb', 'bac', 'bca', 'cab', 'cba']) {
    expect(
      Math.abs((permutations.get(permutation) ?? 0) - expected),
    ).toBeLessThanOrEqual(expected * 0.05);
  }
});

test('performs only the requested swaps on a copy', () => {
  const items = Object.freeze(['a', 'b', 'c']);
  const nextUint32 = vi.fn(() => 1);
  const rng = { nextUint32 };

  expect(partialShuffle(items, 0, rng)).toEqual([]);
  expect(nextUint32).not.toHaveBeenCalled();
  expect(partialShuffle(items, 2, rng)).toEqual(['b', 'c']);
  expect(nextUint32).toHaveBeenCalledTimes(2);
  expect(items).toEqual(['a', 'b', 'c']);
});

test.each([-1, 0.5, NaN, Infinity, 2])(
  'rejects invalid shuffle count %s',
  (count) => {
    expect(() => partialShuffle(['a'], count)).toThrow(RangeError);
  },
);

test('scales a uint32 into the half-open interval [0, 1)', () => {
  expect(randomFloat({ nextUint32: () => 0 })).toBe(0);
  expect(randomFloat({ nextUint32: () => uint32Range / 2 })).toBe(0.5);
  expect(randomFloat({ nextUint32: () => uint32Range - 1 })).toBe(1 - 2 ** -32);
});
