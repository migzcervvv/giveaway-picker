import type { RandomSource } from './types';

// Mulberry32 is deterministic and intended only for tests.
export function seededSource(seed: number): RandomSource {
  let state = seed >>> 0;
  return {
    nextUint32() {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = Math.imul(state ^ (state >>> 15), state | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return (value ^ (value >>> 14)) >>> 0;
    },
  };
}
