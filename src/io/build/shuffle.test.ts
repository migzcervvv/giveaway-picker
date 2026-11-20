// @vitest-environment node
import { test, expect } from 'vitest';
import { buildEntrants, hashEntrants } from '@/engine';
import { shuffleRoster } from './shuffle';

test.each([true, false])(
  'shuffle preserves raw occurrences, hash and original session IDs with dedupe %s',
  async (dedupe) => {
    const names = ['Doe, Jane', 'Éva', 'Eva', '', 'ليلى', 'Eva', '🙂'];
    const options = { dedupe, foldDiacritics: true };
    const previous = buildEntrants(names, options);
    let result = { text: names.join('\n'), build: previous };
    for (let i = 0; i < 5; i++) {
      result = shuffleRoster({
        ...result,
        imported: true,
        options,
        previous: result.build,
      });
      expect(result.text.split('\n').sort()).toEqual([...names].sort());
      expect(result.build.stats).toEqual(previous.stats);
      expect(await hashEntrants(result.build.entrants)).toBe(
        await hashEntrants(previous.entrants),
      );
      for (const e of result.build.entrants)
        expect(previous.entrants.find((old) => old.id === e.id)?.key).toBe(
          e.key,
        );
    }
  },
);
