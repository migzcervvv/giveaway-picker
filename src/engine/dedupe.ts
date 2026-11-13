import { normalizeName } from './normalize';
import type { BuildResult, Entrant } from './types';

export function buildEntrants(
  rawNames: readonly string[],
  opts: { dedupe: boolean; foldDiacritics: boolean },
): BuildResult {
  const entrants: Entrant[] = [];
  const firstByKey = new Map<string, Entrant>();
  const duplicatesByKey = new Map<string, { name: string; count: number }>();
  let blankDropped = 0;
  let duplicatesRemoved = 0;

  for (const raw of rawNames) {
    const normalized = normalizeName(raw, opts);
    if (!normalized) {
      blankDropped++;
      continue;
    }

    const { display, key } = normalized;
    const first = firstByKey.get(key);
    if (first) {
      duplicatesRemoved++;
      const duplicate = duplicatesByKey.get(key);
      if (duplicate) {
        duplicate.count++;
      } else {
        duplicatesByKey.set(key, { name: first.name, count: 1 });
      }
      continue;
    }

    const entrant = { id: `e${entrants.length + 1}`, name: display, key };
    entrants.push(entrant);
    if (opts.dedupe) {
      firstByKey.set(key, entrant);
    }
  }

  return {
    entrants,
    stats: {
      rawCount: rawNames.length,
      blankDropped,
      duplicatesRemoved,
      finalCount: entrants.length,
    },
    duplicates: [...duplicatesByKey.values()],
  };
}
