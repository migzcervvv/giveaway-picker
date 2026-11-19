import { StrictMode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import {
  applyAction,
  buildDrawRecord,
  buildEntrants,
  slotsFromResult,
} from '@/engine';
import type { BuildResult } from '@/engine';
import { BuildSupersededError, createBuildRunner } from '@/io/build/runner';
import type { BuildRunner } from '@/io/build/runner';
import { createSessionStore } from '@/store/session';
import { createSettingsStore } from '@/store/settings';
import { useListBuilder } from './useListBuilder';

const options = { dedupe: true, foldDiacritics: false };
const build = (names: string[]) => buildEntrants(names, options);
function dependencies(runner: BuildRunner = createBuildRunner()) {
  const storage = {
    getItem: () => null,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
  return {
    runner,
    session: createSessionStore(),
    settings: createSettingsStore(storage),
    debounceMs: 250,
  };
}
function controlled() {
  const jobs: {
    resolve: (result: BuildResult) => void;
    reject: (error: Error) => void;
  }[] = [];
  const runner: BuildRunner = {
    build: vi.fn(
      () =>
        new Promise<BuildResult>((resolve, reject) =>
          jobs.push({ resolve, reject }),
        ),
    ),
    cancel: vi.fn(),
    dispose: vi.fn(),
  };
  return { runner, jobs };
}
async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

test('debounces a burst, supports immediate paste and clears a blank list', async () => {
  vi.useFakeTimers();
  const deps = dependencies();
  const cancel = vi.spyOn(deps.runner, 'cancel');
  const setInput = vi.spyOn(deps.session.getState(), 'setInput');
  const { result } = renderHook(() => useListBuilder(deps));
  act(() => {
    result.current.setText('A');
    result.current.setText('Alice');
  });
  expect(result.current.text).toBe('Alice');
  expect(setInput).not.toHaveBeenCalled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });
  expect(setInput).toHaveBeenCalledTimes(1);
  expect(deps.session.getState().build?.entrants[0]?.name).toBe('Alice');
  act(() => result.current.setText('Bob', { immediate: true }));
  expect(deps.session.getState().rawText).toBe('Bob');
  await flush();
  expect(result.current.status).toBe('ready');
  act(() => result.current.clear());
  expect(result.current).toMatchObject({
    text: '',
    status: 'idle',
    error: null,
  });
  expect(deps.session.getState().build).toBeNull();
  expect(cancel).toHaveBeenCalled();
});

test.each([true, false])(
  'applies only job two when job one resolves first=%s',
  async (first) => {
    const { runner, jobs } = controlled();
    const deps = dependencies(runner);
    const { result } = renderHook(() => useListBuilder(deps));
    act(() => result.current.setText('Old', { immediate: true }));
    act(() => result.current.setText('New', { immediate: true }));
    const oldResult = build(['Old']);
    const newResult = build(['New']);
    if (first) {
      await act(async () => jobs[0]?.resolve(oldResult));
      expect(deps.session.getState().build).toBeNull();
      await act(async () => jobs[1]?.resolve(newResult));
    } else {
      await act(async () => jobs[1]?.resolve(newResult));
      await act(async () => jobs[0]?.resolve(oldResult));
    }
    expect(deps.session.getState().build).toEqual(newResult);
    expect(result.current.status).toBe('ready');
  },
);

test('invalidates a pending result as soon as an edit starts, before debounce', async () => {
  vi.useFakeTimers();
  const { runner, jobs } = controlled();
  const deps = dependencies(runner);
  const { result } = renderHook(() => useListBuilder(deps));
  act(() => result.current.setText('Old', { immediate: true }));
  act(() => result.current.setText('New'));
  await act(async () => jobs[0]?.resolve(build(['Old'])));
  expect(result.current.text).toBe('New');
  expect(deps.session.getState().build).toBeNull();
  expect(runner.cancel).toHaveBeenCalledTimes(2);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });
  await act(async () => jobs[1]?.resolve(build(['New'])));
  expect(deps.session.getState().build).toEqual(build(['New']));
});

test('settings rebuild with new options and ignore changed pool generations', async () => {
  const deps = dependencies();
  const { result } = renderHook(() => useListBuilder(deps));
  act(() => result.current.setText('José\nJose\nJosé', { immediate: true }));
  await flush();
  expect(deps.session.getState().build?.stats.finalCount).toBe(2);
  act(() => deps.settings.getState().update({ foldDiacritics: true }));
  await flush();
  expect(deps.session.getState().build?.stats.finalCount).toBe(1);
  act(() => deps.settings.getState().update({ dedupe: false }));
  await flush();
  expect(deps.session.getState().build?.stats.finalCount).toBe(3);

  const { runner, jobs } = controlled();
  const isolated = dependencies(runner);
  const other = renderHook(() => useListBuilder(isolated));
  act(() => other.result.current.setText('Old', { immediate: true }));
  act(() => isolated.session.getState().setInput('Changed externally'));
  await act(async () => jobs[0]?.resolve(build(['Old'])));
  expect(isolated.session.getState().build).toBeNull();
  expect(other.result.current.error).toBeNull();
});

test('locked edits, clear and settings changes are full no-ops until the draw resolves', async () => {
  vi.useFakeTimers();
  const { runner, jobs } = controlled();
  const deps = dependencies(runner);
  const pool = build(['Alice', 'Bob']);
  const state = deps.session.getState();
  state.setInput('Alice\nBob');
  state.setBuild(pool, deps.session.getState().generation);
  const drawResult = { winners: pool.entrants.slice(0, 1), backups: [] };
  const at = '2026-11-19T00:00:00Z';
  const draw = await buildDrawRecord({
    id: 'draw',
    createdAt: at,
    entrants: pool.entrants,
    buildStats: pool.stats,
    config: { ...options, winners: 1, backups: 0, removeCalled: true },
    result: drawResult,
    events: [
      { id: 'drawn', at, type: 'DRAWN', slots: slotsFromResult(drawResult) },
    ],
  });
  const { result } = renderHook(() => useListBuilder(deps));
  act(() =>
    deps.session.getState().setDraw(draw, deps.session.getState().generation),
  );
  const before = deps.session.getState();
  const cancel = vi.mocked(runner.cancel).mock.calls.length;
  expect(result.current.locked).toBe(true);
  act(() => {
    result.current.setText('new');
    result.current.clear();
    deps.settings.getState().update({ dedupe: false });
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
  expect(result.current.text).toBe('Alice\nBob');
  expect(deps.session.getState()).toBe(before);
  expect(runner.cancel).toHaveBeenCalledTimes(cancel);
  expect(runner.build).not.toHaveBeenCalled();
  const events = [
    ...draw.events,
    ...applyAction(
      draw.events,
      { type: 'CALLED', rank: 1 },
      at,
      () => 'called',
    ),
  ];
  act(() =>
    deps.session.getState().setDraw({ ...draw, events }, before.generation),
  );
  expect(result.current.locked).toBe(false);
  act(() => result.current.setText('New', { immediate: true }));
  await act(async () => jobs[0]?.resolve(build(['New'])));
  expect(deps.session.getState().build).toEqual(build(['New']));
});

test('reports failures, ignores superseded rejections and cancels on unmount', async () => {
  const { runner, jobs } = controlled();
  const deps = dependencies(runner);
  const { result, unmount } = renderHook(() => useListBuilder(deps));
  act(() => result.current.setText('One', { immediate: true }));
  await act(async () => jobs[0]?.reject(new Error('Worker failed')));
  expect(result.current).toMatchObject({
    status: 'error',
    error: 'Worker failed',
  });
  act(() => result.current.setText('Two', { immediate: true }));
  await act(async () => jobs[1]?.reject(new BuildSupersededError()));
  expect(result.current.error).toBeNull();
  unmount();
  expect(runner.cancel).toHaveBeenCalledTimes(3);
  expect(runner.dispose).not.toHaveBeenCalled();
});

test('keeps entrants out of browser storage, including with an owned runner in StrictMode', async () => {
  const session = createSessionStore();
  const settings = createSettingsStore(localStorage);
  const storage = vi.spyOn(Storage.prototype, 'setItem');
  const { result } = renderHook(() => useListBuilder({ session, settings }), {
    wrapper: StrictMode,
  });
  act(() => result.current.setText('Private Entrant', { immediate: true }));
  await flush();
  expect(result.current.status).toBe('ready');
  expect(storage).not.toHaveBeenCalled();
  expect(JSON.stringify(localStorage)).not.toContain('Private Entrant');
  expect(sessionStorage.length).toBe(0);
});

test('unmount cancels debounce and prevents a late result from updating the session', async () => {
  vi.useFakeTimers();
  const { runner, jobs } = controlled();
  const deps = dependencies(runner);
  const { result, unmount } = renderHook(() => useListBuilder(deps));
  act(() => result.current.setText('Old', { immediate: true }));
  act(() => result.current.setText('New'));
  const before = deps.session.getState();
  unmount();
  await act(async () => {
    jobs[0]?.resolve(build(['Old']));
    await vi.advanceTimersByTimeAsync(500);
  });
  expect(deps.session.getState()).toBe(before);
  expect(runner.build).toHaveBeenCalledTimes(1);
  expect(runner.cancel).toHaveBeenCalledTimes(3);
});

test('reports session commit and build failures through error state', async () => {
  const deps = dependencies();
  const { result } = renderHook(() => useListBuilder(deps));
  const input = vi
    .spyOn(deps.session.getState(), 'setInput')
    .mockImplementationOnce(() => {
      throw new Error('Input blocked');
    });
  act(() => result.current.setText('Alice', { immediate: true }));
  expect(result.current).toMatchObject({
    status: 'error',
    error: 'Input blocked',
  });
  input.mockRestore();
  vi.spyOn(deps.session.getState(), 'setBuild').mockImplementationOnce(() => {
    throw new Error('Build blocked');
  });
  act(() => result.current.setText('Alice', { immediate: true }));
  await flush();
  expect(result.current).toMatchObject({
    status: 'error',
    error: 'Build blocked',
  });
});
