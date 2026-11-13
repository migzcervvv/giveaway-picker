import { NORMALIZATION_VERSION } from './normalize';
import type { Entrant } from './types';

export async function hashEntrants(
  entrants: readonly Entrant[],
): Promise<string> {
  const keys = entrants
    .map(({ key }) => key)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const bytes = new TextEncoder().encode(
    `${NORMALIZATION_VERSION}\n${keys.join('\n')}`,
  );
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
