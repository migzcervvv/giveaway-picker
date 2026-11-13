import type { RandomSource } from './types';

const uint32Range = 2 ** 32;
const buffer = new Uint32Array(256);
let nextIndex = buffer.length;

export const cryptoSource: RandomSource = {
  nextUint32() {
    if (nextIndex === buffer.length) {
      globalThis.crypto.getRandomValues(buffer);
      nextIndex = 0;
    }

    // The refill guarantees the cursor is in bounds before each read.
    return buffer[nextIndex++]!;
  },
};

export function uniformInt(maxExclusive: number, rng = cryptoSource): number {
  if (
    !Number.isInteger(maxExclusive) ||
    maxExclusive < 1 ||
    maxExclusive > uint32Range
  ) {
    throw new RangeError('maxExclusive must be an integer from 1 through 2^32');
  }

  // Only the complete groups of maxExclusive values give each remainder equal weight.
  const limit = uint32Range - (uint32Range % maxExclusive);
  let value: number;

  do {
    value = rng.nextUint32();
  } while (value >= limit);

  return value % maxExclusive;
}

export function partialShuffle<T>(
  items: readonly T[],
  count: number,
  rng = cryptoSource,
): T[] {
  if (!Number.isInteger(count) || count < 0 || count > items.length) {
    throw new RangeError(
      'count must be an integer from 0 through items.length',
    );
  }

  const shuffled = [...items];
  for (let i = 0; i < count; i++) {
    const j = i + uniformInt(shuffled.length - i, rng);
    // Both indices are within the copy, including when i equals j.
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }

  return shuffled.slice(0, count);
}

export function randomFloat(rng = cryptoSource): number {
  return rng.nextUint32() / uint32Range;
}
