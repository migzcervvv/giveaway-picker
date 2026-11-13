import { cryptoSource, partialShuffle } from './rng';
import type { DrawConfig, DrawResult, Entrant } from './types';

const errorMessages = {
  WINNERS_MIN: 'winners must be a positive integer',
  BACKUPS_NEG: 'backups must be a non-negative integer',
  EMPTY_POOL: 'the entrant pool is empty',
  EXCEEDS_POOL: 'the requested winners and backups exceed the entrant pool',
};

export class DrawConfigError extends Error {
  constructor(public readonly code: keyof typeof errorMessages) {
    super(errorMessages[code]);
    this.name = 'DrawConfigError';
  }
}

export function draw(
  pool: readonly Entrant[],
  cfg: DrawConfig,
  rng = cryptoSource,
): DrawResult {
  const { winners, backups } = cfg;
  if (!Number.isInteger(winners) || winners < 1) {
    throw new DrawConfigError('WINNERS_MIN');
  }
  if (!Number.isInteger(backups) || backups < 0) {
    throw new DrawConfigError('BACKUPS_NEG');
  }
  if (pool.length === 0) {
    throw new DrawConfigError('EMPTY_POOL');
  }

  const count = winners + backups;
  if (count > pool.length) {
    throw new DrawConfigError('EXCEEDS_POOL');
  }

  const selected = partialShuffle(pool, count, rng);
  return {
    winners: selected.slice(0, winners),
    backups: selected.slice(winners),
  };
}
