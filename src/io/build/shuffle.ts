import { buildEntrants, partialShuffle, splitPaste } from '@/engine';
import type { BuildResult } from '@/engine';
import type { BuildOptions } from './protocol';

export type ShuffleRequest = {
  text: string;
  imported: boolean;
  options: BuildOptions;
  previous: BuildResult;
};
export function shuffleRoster({
  text,
  imported,
  options,
  previous,
}: ShuffleRequest) {
  const names = imported ? text.split('\n') : splitPaste(text);
  const shuffled = partialShuffle(names, names.length);
  const build = buildEntrants(shuffled, options);
  // IDs refer to session history. Reordering must preserve each occurrence's ID.
  const ids = new Map<string, string[]>();
  for (const entrant of [...previous.entrants].reverse()) {
    const key = options.dedupe ? entrant.key : entrant.name;
    const group = ids.get(key);
    if (group) group.push(entrant.id);
    else ids.set(key, [entrant.id]);
  }
  for (const entrant of build.entrants) {
    const id = ids.get(options.dedupe ? entrant.key : entrant.name)?.pop();
    if (!id) throw new Error('Roster changed during shuffle');
    entrant.id = id;
  }
  return { text: shuffled.join('\n'), build };
}
