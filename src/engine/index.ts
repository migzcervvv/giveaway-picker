export { buildEntrants } from './dedupe';
export { DrawConfigError, draw } from './draw';
export { applyAction, deriveState, slotsFromResult } from './lifecycle';
export type { DrawEvent, Slot, SlotStatus } from './lifecycle';
export { NORMALIZATION_VERSION, normalizeName } from './normalize';
export { looksTabular, splitPaste } from './paste';
export { eligiblePool } from './pool';
export { cryptoSource, partialShuffle, randomFloat, uniformInt } from './rng';
export type {
  BuildResult,
  BuildStats,
  DrawConfig,
  DrawResult,
  Entrant,
  RandomSource,
} from './types';
