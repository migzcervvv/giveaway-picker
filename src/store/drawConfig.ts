import { createStore } from 'zustand/vanilla';

export type DrawCounts = { winners: number; backups: number };
const defaults: DrawCounts = { winners: 1, backups: 0 };

export function clampCounts(counts: DrawCounts, poolSize: number): DrawCounts {
  const size = Number.isFinite(poolSize)
    ? Math.max(0, Math.trunc(poolSize))
    : 0;
  const winners = Math.max(
    1,
    Math.min(
      Number.isFinite(counts.winners) ? Math.trunc(counts.winners) : 1,
      Math.max(size, 1),
    ),
  );
  const backups = Math.max(
    0,
    Math.min(
      Number.isFinite(counts.backups) ? Math.trunc(counts.backups) : 0,
      Math.max(size - winners, 0),
    ),
  );
  return { winners, backups };
}

type DrawConfigState = DrawCounts & {
  setWinners(value: number, poolSize: number): void;
  setBackups(value: number, poolSize: number): void;
  clamp(poolSize: number): void;
  reset(): void;
};

export function createDrawConfigStore() {
  return createStore<DrawConfigState>((set, get) => ({
    ...defaults,
    setWinners: (winners, size) =>
      set(clampCounts({ ...get(), winners }, size)),
    setBackups: (backups, size) =>
      set(clampCounts({ ...get(), backups }, size)),
    clamp: (size) => set(clampCounts(get(), size)),
    reset: () => set(defaults),
  }));
}

export const drawConfigStore = createDrawConfigStore();
