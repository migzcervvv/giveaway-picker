---
id: T06b
title: Memory-only session, settings, history store, unload guard
status: stub
depends_on: [T06a]
branch: codex/T06b-store-session
---
# T06b Memory-only session, settings, history store, unload guard

**Not dispatchable until T06a is merged and the planner sets `status: ready`.** The specification is complete for review but depends on the actual merged T06a repository API.

## Goal
Connect the pure draw engine and T06a IndexedDB repository to memory-only session state, persisted non-sensitive preferences, history actions, and an unresolved-draw leave warning. Preserve strict pool/session boundaries and do not implement UI or draw orchestration.

## Read first
- `AGENTS.md`; `docs/HANDOFF.md`; `docs/ARCHITECTURE.md` sections 1, 4, 5 and 10.
- `docs/DECISIONS.md` D-003, D-006, D-018, D-019, D-020, D-021, D-022.
- Merged T06a repository public API and tests, `src/engine/lifecycle.ts`, `pool.ts`, `record.ts`, and `index.ts`.

## Scope (files to create or modify)
- `src/store/session.ts`, `settings.ts`, `history.ts`, `leaveGuard.ts`, and colocated `*.test.ts` files.
- Minimal `src/main.tsx` installation and cleanup of the leave guard, without UI changes.
- `package.json` / `pnpm-lock.yaml`: add exactly pinned runtime `zustand`; reuse T06a's Dexie and test-only `fake-indexeddb` (do not add duplicate dependencies).
- `docs/tasks/T06b-store-session.md`: update status only in the implementation PR, and update `docs/HANDOFF.md` Codex-owned Current state/task index.

## Out of scope
- Dexie schema/repository redesign (T06a); engine business rules; React screens; UI confirmation dialogs; drawing or reveal orchestration (T07/T08); file import/export; network access; persisted rosters; cross-tab synchronization.

## Spec
1. `session.ts`: create an unpersisted Zustand session store holding raw input text, current `BuildResult`/entrants, a memory-only pool-generation identifier, and only ordered draw records belonging to that specific pool generation. Provide typed input/build replacement, current-pool draw add/replace, and clear/reset actions. No Zustand `persist` middleware or disk/localStorage writes for this store.
2. **D-020:** changing the input or rebuilding the pool invalidates old pool-associated draw events and entrant IDs; never infer association from `e1`-style IDs or from `listHash`. A change must be rejected while any current-pool draw remains `pending`/`promoted` (D-018), rather than silently discarding unresolved progress. After all associated draws resolve, a deliberate replacement clears their current-pool association but leaves Dexie history untouched. Ensure stale async results or records tagged with an earlier pool generation cannot reattach to a replacement pool.
3. Make only current-pool, in-memory draw events available for an eventual `eligiblePool()` call. Do not pass T06a's persisted history or history-store records to `eligiblePool()` for a fresh pool after reload. Test two distinct lists reusing `e1`/`e2` and two builds with the same order-independent hash.
4. Provide `prepareAction(drawId, action, now, newId): DrawEvent[]` that reads the associated current-pool record, rejects unknown/stale draws, and delegates to the pure engine `applyAction()` without changing either session state or persistence. **D-019:** `UNDO` is permitted only on the latest-created draw in the current in-memory session; earlier draws may still receive `CALLED`/`NO_SHOW` actions. The resulting batch is for T08 to persist before committing a new session snapshot. After a reload, old history-only draws cannot be undone.
5. `settings.ts`: Zustand `persist` with an explicit whitelist of only `soundEnabled`, `revealMode`, `theme`, `dedupe`, `foldDiacritics`, `removeCalled`, `oneAtATime`. Provide typed defaults/reset and a testing-friendly storage adapter. Never persist raw text, entrants, event log, session state, or history records in localStorage.
6. `history.ts`: async Zustand store with `records`, `loading`, and `error`, plus `load`, `save`, `append`, `remove`, `clear`. Depend on the injected, typed T06a repository. **Persist first**, then refresh/change in-memory records on success; rejected writes must retain truthful state and expose errors. Preserve event order and stale expected-length conflicts. Do not implement another record/event schema or lifecycle reducer.
7. `leaveGuard.ts`: installable `beforeunload` listener backed by the current in-memory session. It warns iff at least one associated draw has a `pending` or `promoted` slot per `deriveState()`. Standby alone is not open. Support injected target for tests, event prevention/`returnValue` for browser compatibility, and unsubscribing/removal on cleanup. Wire minimally in `src/main.tsx`, avoiding duplicate handlers across dev/test unmounts.
8. No UI, route changes, HTTP requests, worker orchestration, or optimistic event commits. Keep the stores testable without mounting React components.

## Acceptance criteria
- [ ] Reload reconstructs whitelisted settings and T06a saved history; a fresh session starts with empty raw text, no entrants, and no current-pool draw associations.
- [ ] localStorage contains only the settings whitelist; never raw input, full `Entrant[]`, draw slots/events or history records.
- [ ] Input and pool replacement cannot silently discard an unresolved draw; after closing a draw they detach old associations without deleting saved history.
- [ ] Current-pool generation invalidates stale updates; reused IDs (`e1`, `e2`) and identical list hashes do not pull previous session/pool exclusions into the next draw.
- [ ] An earlier draw's `UNDO` is rejected after a later draw is created, whereas latest-draw `UNDO` and earlier-draw non-undo transitions continue to work.
- [ ] `prepareAction()` is pure with respect to store state and does not persist or optimistically append events.
- [ ] History store supports load/save/append/delete/clear using the real T06a repository; unsuccessful DB operations propagate errors without showing a false success or losing committed events.
- [ ] Unload warning appears only for unresolved `pending`/`promoted` slots; no warning for a fully resolved draw with leftover `standby` backups. Handler cleanup prevents subsequent warnings.
- [ ] `pnpm verify` and GitHub CI pass; engine invariants, privacy, and no-network rules remain satisfied.

## Required tests
- Zustand store transitions, replacement protection, pool-generation/race safety, new-session reinitialization, cross-draw undo, and no-history contamination of the eligible pool.
- Settings serialization/reload with all seven whitelisted properties and unexpected raw-name fields excluded.
- History-store tests backed by `fake-indexeddb` using T06a's real repository, including failed persistence and event conflict.
- Injectable EventTarget `beforeunload` tests for pending, promoted, called, no-show, fully resolved with standby, undone/reopened, and cleanup.

## Verification
`pnpm verify` (typecheck, lint, test, build). Review GitHub `verify` check for the exact submitted head SHA.

## PR notes
- The reviewer will scrutinize D-019/D-020 boundary enforcement, history-store persistence ordering, and unload-guard behavior.
- If the actual merged T06a API makes these signatures awkward, propose the smallest compatible adjustment in the PR without expanding scope.
- Do not begin while status is `stub`. After T06a merges, the planner must separately authorize `ready` before Codex starts.
