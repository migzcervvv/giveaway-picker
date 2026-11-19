import { expect, test, vi } from 'vitest';
import { clampCounts, createDrawConfigStore } from './drawConfig';

test.each([
  [0, 5, 5, 1, 0],
  [-2, 5, 5, 1, 0],
  [1, 9, 9, 1, 0],
  [2, 9, 9, 2, 0],
  [10, 3.9, 8.8, 3, 7],
  [10, -4, -2, 1, 0],
  [10, 0, 0, 1, 0],
  [10, NaN, Infinity, 1, 0],
  [2, Infinity, 1, 1, 1],
  [1, -1, 20, 1, 0],
  [2, 1.9, 1.9, 1, 1],
])(
  'clamps pool=%s counts=%s/%s to %s/%s',
  (pool, winners, backups, expectedWinners, expectedBackups) => {
    expect(clampCounts({ winners, backups }, pool)).toEqual({
      winners: expectedWinners,
      backups: expectedBackups,
    });
  },
);

test('store actions re-clamp and reset without storage writes', () => {
  const storage = vi.spyOn(Storage.prototype, 'setItem');
  try {
    const store = createDrawConfigStore();
    store.getState().setBackups(8, 10);
    store.getState().setWinners(7, 10);
    expect(store.getState()).toMatchObject({ winners: 7, backups: 3 });
    store.getState().clamp(2);
    expect(store.getState()).toMatchObject({ winners: 2, backups: 0 });
    store.getState().reset();
    expect(store.getState()).toMatchObject({ winners: 1, backups: 0 });
    expect(storage).not.toHaveBeenCalled();
  } finally {
    storage.mockRestore();
  }
});
