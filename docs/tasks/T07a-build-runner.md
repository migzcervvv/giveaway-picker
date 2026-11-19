---
id: T07a
title: List build runner, draw-config store, useListBuilder hook
status: done
depends_on: [T06a, T06b]
branch: codex/T07a-build-runner
---
# T07a List build runner, draw-config store, useListBuilder hook

## Goal
Non-visual plumbing for the input screen: build the entrant list off the main thread with latest-wins semantics, keep winner/backup counts in a memory-only store with clamping, and bind raw text plus settings to the session store in one hook. T07b adds the UI on top.

## Read first
AGENTS.md; ARCHITECTURE sections 3, 4, 9, 10; DECISIONS D-002, D-003, D-006, D-018, D-020, D-023, D-025; `src/store/session.ts`, `src/store/settings.ts`, `src/store/leaveGuard.ts`.

## Scope
Create:
- `src/io/build/protocol.ts`
- `src/io/build/build.worker.ts`
- `src/io/build/runner.ts`
- `src/store/drawConfig.ts`
- `src/ui/hooks/useListBuilder.ts`
- colocated tests for every file above except `protocol.ts`
- Codex-owned updates: this card's `status`, HANDOFF "Current state"

## Out of scope
Any component, `App.tsx` change, CSS, routing, file import, Draw button, history UI, new dependencies, edits to `src/engine`, `src/db`, or existing store files.

## Spec

### protocol.ts
```ts
import type { BuildResult } from '@/engine';
export type BuildOptions = { dedupe: boolean; foldDiacritics: boolean };
export type BuildRequest = BuildOptions & { id: number; names: string[] };
export type BuildResponse =
  | { id: number; ok: true; result: BuildResult }
  | { id: number; ok: false; message: string };
```

### build.worker.ts
Receives a `BuildRequest`, calls `buildEntrants(names, { dedupe, foldDiacritics })` from `@/engine`, posts a `BuildResponse`. On a thrown error posts `ok: false` with the message. Imports only `@/engine` and `./protocol`. No DOM globals.

### runner.ts
```ts
export class BuildSupersededError extends Error {}
export interface WorkerLike {
  postMessage(message: BuildRequest): void;
  terminate(): void;
  onmessage: ((event: { data: BuildResponse }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}
export interface BuildRunner {
  build(names: readonly string[], options: BuildOptions): Promise<BuildResult>;
  cancel(): void;
  dispose(): void;
}
export function createBuildRunner(config?: {
  threshold?: number;                   // default 5000
  createWorker?: () => WorkerLike;      // default: new Worker(new URL('./build.worker.ts', import.meta.url), { type: 'module' })
}): BuildRunner;
```
Rules:
- `names.length <= threshold`: run `buildEntrants` inline. The promise always settles asynchronously (never synchronously inside `build()`).
- Above the threshold: create a worker, post a request, resolve on the response with the matching id, terminate the worker as soon as the call settles.
- If `Worker` is undefined or `createWorker` throws, fall back to inline silently.
- Every `build()` call supersedes the previous pending call: the previous promise rejects with `BuildSupersededError` and its worker is terminated. `cancel()` does the same without starting a new build. `dispose()` is `cancel()` plus: later `build()` calls throw.
- A response whose id is not the current id is ignored.
- Worker `onerror` or an `ok: false` response rejects with an `Error` carrying a readable message and terminates the worker.

### drawConfig.ts
```ts
export type DrawCounts = { winners: number; backups: number };
export function clampCounts(counts: DrawCounts, poolSize: number): DrawCounts;
type DrawConfigState = DrawCounts & {
  setWinners(value: number, poolSize: number): void;
  setBackups(value: number, poolSize: number): void;
  clamp(poolSize: number): void;
  reset(): void;
};
export function createDrawConfigStore(): StoreApi<DrawConfigState>;   // zustand/vanilla
export const drawConfigStore: ReturnType<typeof createDrawConfigStore>;
```
Rules: defaults `{ winners: 1, backups: 0 }`. `clampCounts`: non-finite values become the defaults; values are truncated to integers; winners in `[1, max(poolSize, 1)]`; backups in `[0, max(poolSize - winners, 0)]`. Pool size 0 or negative gives `{ 1, 0 }`. `setWinners` clamps winners, then re-clamps backups. `setBackups` clamps against the current winners. Memory only: never touches localStorage, sessionStorage, or IndexedDB.

### useListBuilder.ts
```ts
export type ListBuilder = {
  text: string;
  status: 'idle' | 'building' | 'ready' | 'error';
  error: string | null;
  locked: boolean;                       // hasUnresolvedDraw(session.draws), reactive
  setText(text: string, options?: { immediate?: boolean }): void;
  clear(): void;
};
export function useListBuilder(deps?: {
  runner?: BuildRunner;
  session?: typeof sessionStore;
  settings?: typeof settingsStore;
  debounceMs?: number;                   // default 250
}): ListBuilder;
```
Behavior:
1. `text` is local state, initialized from `session.getState().rawText`. `setText` checks `locked` before updating local text, scheduling/resetting debounce, canceling/restarting a worker, or changing session state. While locked, `setText` and `clear` are full no-ops. An accepted, unlocked text edit immediately increments the job token and cancels prior work, invalidating any pending build result before debounce. It updates local text immediately and commits after `debounceMs`, or in the same tick with `{ immediate: true }` (used for paste). A newer accepted call resets the timer.
2. Commit(text): if `locked`, return (no-op, never throws). Otherwise call `session.setInput(text)` inside try/catch (an error sets status `error`). If `text.trim() === ''`: `runner.cancel()`, status `idle`. Otherwise start a build job.
3. Build job: `jobId = ++latestJob`; `generation = session.getState().generation` (read after `setInput`); status `building`; `runner.build(splitPaste(text), { dedupe, foldDiacritics })` using current settings. On resolve: if `jobId !== latestJob`, ignore; else `session.setBuild(result, generation)` and status `ready`. `BuildSupersededError` is ignored. A `setBuild` failure caused by a changed generation is ignored silently. Any other error sets status `error` with its message. The hook applies the job-id guard itself and must not rely on the runner for ordering.
4. Settings: subscribe to `dedupe` and `foldDiacritics`. When either changes, text is non-blank and not `locked`, start a new build job with the current generation and no `setInput`. Changes while `locked` are ignored.
5. `clear()` is `setText('', { immediate: true })`; no-op while `locked`.
6. Unmount: clear the timer and call `runner.cancel()`. A runner the hook created itself is disposed on unmount.
7. Raw text and names are never written to localStorage, sessionStorage, IndexedDB, console, or the URL.

## Acceptance criteria
- [ ] Inline and worker paths return identical results for the same input (fake worker backed by `buildEntrants`).
- [ ] Newer builds supersede older ones; superseded promises reject with `BuildSupersededError`; workers are terminated on success, supersede, error, and cancel.
- [ ] Out-of-order resolution is safe in both orders: only the latest job is applied.
- [ ] Settings toggles rebuild the same text; stale generations are ignored.
- [ ] While `locked`, `setText`, `clear` and settings rebuilds are no-ops and never throw; unlocking restores normal behavior.
- [ ] `clampCounts` satisfies every rule above, table-tested.
- [ ] No names in localStorage or sessionStorage after typing (privacy test).
- [ ] No new dependencies. `pnpm verify` green.
- [ ] PR description reports non-test and test changed-line counts separately (D-023).

## Required tests
- `runner.test.ts`: inline path; worker path above threshold (assert `createWorker` called at 5001 names); message protocol shape; terminate on success, supersede, error, cancel; stale-id response ignored; `onerror` rejects; fallback to inline when `createWorker` throws; `dispose()` then `build()` throws.
- `drawConfig.test.ts`: `clampCounts` for pool sizes 0, 1, 2, 10 against negative, 0, decimal, NaN, Infinity, winners above pool, backups above pool minus winners; `setWinners` shrinks backups; spy on `Storage.prototype.setItem` to prove nothing is written.
- `useListBuilder.test.tsx` (`renderHook`, fake timers, inline or controllable fake runner, fresh stores): debounce yields one commit per burst; `immediate` commits at once; blank text gives `idle`, calls `cancel()`, and leaves `session.build` null; dedupe and fold toggles rebuild with updated stats; out-of-order resolution via a controllable fake runner (job 1 resolving after job 2, and before it); an old pending result resolving during a newer text edit's debounce is ignored; stale generation ignored; locked state seeded with an unresolved draw (`buildDrawRecord` + `session.setDraw`): `setText('new')` changes neither visible text nor session raw text, build, generation, or draw records, and neither `setText` nor `clear` resets timers or cancels/restarts work; unlocking restores edits; unmount cancels the runner; privacy test.

## PR notes
Review `runner.ts` supersede and terminate paths first, then the hook's job-id guard. Expected size: about 300 non-test lines.
