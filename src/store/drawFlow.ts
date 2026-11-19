import { createStore } from 'zustand/vanilla';
import {
  buildDrawRecord,
  deriveState,
  draw,
  eligiblePool,
  slotsFromResult,
  uniformInt,
} from '@/engine';
import type { RandomSource } from '@/engine';
import { sessionStore } from './session';
import { historyStore } from './history';
import { settingsStore } from './settings';
import { drawConfigStore } from './drawConfig';

type DrawAction = Parameters<
  ReturnType<typeof sessionStore.getState>['prepareAction']
>[1];
const secureId = () =>
  Array.from({ length: 4 }, () =>
    uniformInt(2 ** 32)
      .toString(16)
      .padStart(8, '0'),
  ).join('');

export function createDrawFlow({
  session = sessionStore,
  history = historyStore,
  settings = settingsStore,
  counts = drawConfigStore,
  now = () => new Date().toISOString(),
  newId = secureId,
  rng,
}: {
  session?: typeof sessionStore;
  history?: typeof historyStore;
  settings?: typeof settingsStore;
  counts?: typeof drawConfigStore;
  now?: () => string;
  newId?: () => string;
  rng?: RandomSource;
} = {}) {
  return createStore<FlowState>((set, get) => {
    async function run(operation: (saved: () => void) => Promise<void>) {
      if (get().busy) return;
      set({ busy: true, error: null });
      let persisted = false;
      try {
        await operation(() => {
          persisted = true;
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Please retry';
        set({
          error: persisted
            ? `Saved to history, but not attached to the current session. ${message}`
            : message,
        });
      } finally {
        set({ busy: false });
      }
    }
    function check(generation: symbol) {
      if (session.getState().generation !== generation)
        throw new Error('The entrant pool changed');
    }
    return {
      session,
      settings,
      counts,
      busy: false,
      error: null,
      activeId: null,
      visible: {},
      announcement: '',
      start: (ready) =>
        run(async (saved) => {
          const { build, generation, draws } = session.getState();
          if (!ready || !build)
            throw new Error('Wait for the current input to finish building');
          const preferences = settings.getState();
          const eligible = eligiblePool(
            build.entrants,
            draws.map(({ events }) => events),
            preferences,
          );
          if (!eligible.length) throw new Error('No eligible entrants remain');
          counts.getState().clamp(eligible.length);
          const { winners, backups } = counts.getState();
          const config = {
            winners,
            backups,
            dedupe: preferences.dedupe,
            foldDiacritics: preferences.foldDiacritics,
            removeCalled: preferences.removeCalled,
          };
          const result = draw(eligible, config, rng);
          const id = newId(),
            createdAt = now();
          const record = await buildDrawRecord({
            id,
            createdAt,
            buildStats: build.stats,
            entrants: build.entrants,
            config,
            result,
            events: [
              {
                id: newId(),
                at: createdAt,
                type: 'DRAWN',
                slots: slotsFromResult(result),
              },
            ],
          });
          check(generation);
          const stored = await history.getState().save(record);
          saved();
          check(generation);
          session.getState().setDraw(stored, generation);
          const visible = preferences.oneAtATime ? 1 : stored.slots.length;
          set({
            activeId: id,
            visible: { ...get().visible, [id]: visible },
            announcement: `Draw saved. ${stored.slots
              .slice(0, visible)
              .map(({ name }) => name)
              .join(', ')}`,
          });
        }),
      act: (id, action) =>
        run(async (saved) => {
          const { generation, draws, prepareAction } = session.getState();
          const record = draws.find((draw) => draw.id === id);
          if (!record)
            throw new Error('Draw does not belong to the current pool');
          const appended = prepareAction(id, action, now(), newId);
          const updated = await history
            .getState()
            .append(id, appended, record.events.length);
          saved();
          check(generation);
          session.getState().setDraw(updated, generation);
          const state = deriveState(updated.events);
          const promoted = appended.find((event) => event.type === 'PROMOTED');
          set({
            announcement:
              action.type === 'UNDO'
                ? 'Latest action undone.'
                : `${state.slots.find(({ rank }) => rank === action.rank)?.name} marked ${action.type === 'CALLED' ? 'called' : 'no-show'}.${promoted?.type === 'PROMOTED' ? ` ${state.slots.find(({ rank }) => rank === promoted.backupRank)?.name} promoted.` : ''}`,
          });
        }),
      canUndo(id) {
        try {
          session
            .getState()
            .prepareAction(id, { type: 'UNDO' }, '', () => 'preview');
          return true;
        } catch {
          return false;
        }
      },
      show: (activeId) => {
        if (!get().busy) set({ activeId, announcement: '' });
      },
      next(id) {
        const record = session.getState().draws.find((draw) => draw.id === id);
        if (!record || get().busy) return;
        const visible =
          deriveState(record.events).slots.find(
            (slot) =>
              slot.rank > (get().visible[id] ?? record.slots.length) &&
              (slot.role !== 'backup' || slot.status === 'standby'),
          )?.rank ?? record.slots.length;
        set({
          visible: { ...get().visible, [id]: visible },
          announcement: record.slots[visible - 1]?.name ?? '',
        });
      },
    };
  });
}
type FlowState = {
  session: typeof sessionStore;
  settings: typeof settingsStore;
  counts: typeof drawConfigStore;
  busy: boolean;
  error: string | null;
  activeId: string | null;
  visible: Record<string, number>;
  announcement: string;
  start(ready: boolean): Promise<void>;
  act(id: string, action: DrawAction): Promise<void>;
  canUndo(id: string): boolean;
  show(id: string | null): void;
  next(id: string): void;
};
export const drawFlowStore = createDrawFlow();
