import { createStore } from 'zustand/vanilla';
import { applyAction, deriveState, toExportJson } from '@/engine';
import type { BuildResult, DrawRecord } from '@/engine';
type BuildOptions = { dedupe: boolean; foldDiacritics: boolean };
const defaultOptions: BuildOptions = { dedupe: true, foldDiacritics: false };

export function hasUnresolvedDraw(draws: readonly DrawRecord[]): boolean {
  return draws.some(({ events }) =>
    deriveState(events).slots.some(
      ({ status }) => status === 'pending' || status === 'promoted',
    ),
  );
}

export function createSessionStore() {
  return createStore((set, get: () => SessionState): SessionState => {
    function resetPool(
      rawText: string,
      build: BuildResult | null,
      buildOptions = get().buildOptions,
      imported = false,
    ) {
      if (hasUnresolvedDraw(get().draws))
        throw new Error('Resolve the current draws before replacing the pool');
      set({
        rawText,
        imported,
        build,
        buildOptions,
        generation: Symbol(),
        draws: [],
      });
    }

    function checkGeneration(generation: symbol) {
      if (get().generation !== generation)
        throw new Error('The entrant pool has changed');
    }

    return {
      rawText: '',
      imported: false,
      build: null,
      buildOptions: defaultOptions,
      generation: Symbol(),
      draws: [],
      setInput(rawText, imported = false) {
        if (imported || get().imported || rawText !== get().rawText)
          resetPool(rawText, null, get().buildOptions, imported);
      },
      setBuild(build, generation, buildOptions = defaultOptions) {
        checkGeneration(generation);
        resetPool(get().rawText, build, buildOptions, get().imported);
      },
      reset() {
        resetPool('', null);
      },
      setDraw(record, generation) {
        checkGeneration(generation);
        const { build, draws } = get();
        if (!build) throw new Error('No active entrant pool');
        const previous = draws.find(({ id }) => id === record.id);
        if (
          previous &&
          (record.events.length < previous.events.length ||
            toExportJson({
              ...record,
              events: record.events.slice(0, previous.events.length),
            }) !== toExportJson(previous))
        ) {
          throw new Error(
            'A draw update must preserve its identity and extend its event log',
          );
        }
        const next = draws.some(({ id }) => id === record.id)
          ? draws.map((draw) => (draw.id === record.id ? record : draw))
          : [...draws, record];
        set({ draws: next });
      },
      prepareAction(drawId, action, now, newId) {
        const { draws } = get();
        const record = draws.find(({ id }) => id === drawId);
        if (!record)
          throw new Error('Draw does not belong to the current pool');
        if (action.type === 'UNDO' && draws.at(-1) !== record) {
          throw new Error('Only the latest draw can be undone');
        }
        return applyAction(record.events, action, now, newId);
      },
    };
  });
}

type SessionState = {
  rawText: string;
  imported: boolean;
  build: BuildResult | null;
  buildOptions: BuildOptions;
  generation: symbol;
  draws: readonly DrawRecord[];
  setInput(rawText: string, imported?: boolean): void;
  setBuild(
    build: BuildResult,
    generation: symbol,
    options?: BuildOptions,
  ): void;
  reset(): void;
  setDraw(record: DrawRecord, generation: symbol): void;
  prepareAction(
    drawId: string,
    action: Parameters<typeof applyAction>[1],
    now: string,
    newId: () => string,
  ): ReturnType<typeof applyAction>;
};

export const sessionStore = createSessionStore();
