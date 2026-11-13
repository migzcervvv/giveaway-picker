---
id: T06
title: Store + Dexie history
status: ready
depends_on: [T05]
branch: codex/T06-store-db
---
# T06 Store + Dexie history

## Goal
Provide memory-only raffle-session state, persisted non-sensitive settings, and IndexedDB draw history. Keep the full entrant list out of all persistent storage. Do not implement the UI or draw orchestration yet.

## Read first
- `AGENTS.md`; `docs/HANDOFF.md`; `docs/ARCHITECTURE.md` sections 1, 4, 5, and 10.
- `docs/DECISIONS.md`: D-003, D-006, D-018, D-019, D-020, D-021.
- Current `src/engine/record.ts`, `lifecycle.ts`, `pool.ts`, `types.ts` and public `index.ts`.

## Scope
- `src/db/schema.ts`, `src/db/repos.ts`, colocated tests.
- `src/store/session.ts`, `settings.ts`, `history.ts`, `leaveGuard.ts`, colocated tests.
- Minimal `src/main.tsx` wiring of the unload guard, without new UI.
- `package.json` / `pnpm-lock.yaml`: add exactly pinned runtime `zustand`, `dexie`, and dev `fake-indexeddb`; these packages are authorized for T06. Choose compatible stable versions and report the actual versions in the PR.
- T05 status and `docs/HANDOFF.md` Codex-owned Current state/task index updates.

## Out of scope
- UI components, page routing, imports/exports, spreadsheet parsing, animation, migrations beyond DB version 1, network access, new engine business rules, a persistent full entrant roster.
- T07 and T08 own the actual input screen and draw-flow orchestration. Do not invent presentation behavior here.

## Database contract
1. Define a Dexie database with a version 1 `draws` table keyed by `DrawRecord.id` and indexed by `createdAt`. Store the `DrawRecord` fields specified by ARCHITECTURE §4, including selected winner/backup names and event history, but **never** `Entrant[]`, raw paste text, or unselected names. Use an injectable database instance in repo tests; keep the production singleton simple.
2. Expose typed repository functions (or one small repository object): `saveRecord(record)`, `getRecord(id)`, `listRecords()`, `appendEvents(id, appended, expectedEventCount)`, `deleteRecord(id)`, `clearRecords()`. Return records newest-first, breaking equal timestamps deterministically by ID.
3. Explicitly project/allowlist the persisted record structure and nested selected slots/events. Do not blindly persist caller-provided extra properties. Reject or drop any unexpected `entrants`, `rawText`, or equivalent fields, including nested extras. Keep a single authoritative record schema, not a second business-logic implementation.
4. `saveRecord` checks that the initial event is a `DRAWN` event whose ranked slots equal the record's selected `slots`; reject mismatches rather than recording an unverifiable result. It must not mutate the supplied record.
5. `appendEvents` atomically reads the record, confirms `events.length === expectedEventCount`, and appends only genuinely new event IDs. Reject a missing record, duplicate IDs, a new `DRAWN`, or a stale expected count with an explicit error; never lose previously committed events. Use a single Dexie read-write transaction. Append-only means no edits or deletion of individual events.
6. Propagate IndexedDB failures to the caller; never fall back to writing entrant names into localStorage or another persistence mechanism.

## Store contract
1. `session.ts`: Zustand store, **not persisted**. Hold raw text, current `BuildResult`/entrant pool, and only the draws associated with that exact in-memory pool. Provide simple typed actions to update input, set build results, add/replace current-pool draw records, and clear/reset the session. Provide `prepareAction(drawId, action, now, newId): DrawEvent[]` that validates the undo guard and delegates to the engine `applyAction()` against the current in-memory record without mutating it; a separately persisted, returned record can then replace the session copy. Reuse engine types; do not introduce a second lifecycle reducer.
2. D-020: persisted history from another page load or a changed input pool must **never** be passed to `eligiblePool()` based on the reused `e1`, `e2`, ... IDs. On a deliberate pool replacement/reset, clear the current-pool draw association but leave IndexedDB history intact. Do not silently reset an unresolved draw: reject pool replacement while any associated draw has `pending`/`promoted` slots, with a test. T08 may later provide a user-facing confirmation path.
3. D-019: `prepareAction()` must reject `UNDO` for any draw other than the most recently created draw in the current in-memory session; after reload no previous session draw can be undone. Keep pure engine `applyAction()` unchanged. A later draw may still resolve older pending slots without undoing them. `prepareAction()` does not optimistically commit state: T08 can persist the returned event batch first, then update session history on success.
4. `settings.ts`: Zustand `persist` with a **whitelist** of non-entrant values only: `soundEnabled`, `revealMode`, `theme`, `dedupe`, `foldDiacritics`, `removeCalled`, `oneAtATime`. Provide defaults and reset. Never persist session state or draw history in Zustand/localStorage. Use a configurable/injectable storage adapter for tests if useful.
5. `history.ts`: expose loading/error/records state and asynchronous `load`, `save`, `append`, `remove`, `clear` actions backed by the typed Dexie repository. Persist first, then update in-memory history; report errors rather than silently claiming success. Preserve chronological event order.
6. `leaveGuard.ts`: implement an installable `beforeunload` guard using the current in-memory session. It warns only when at least one same-pool draw has unresolved `pending` or `promoted` slots; `standby` alone does not make a draw open (D-018). Wire it minimally in `src/main.tsx`, and support cleanup. Browser UI decides whether to actually display a dialog. The guard must not persist any roster.

## Acceptance criteria
- [ ] Reload preserves saved history and the settings whitelist; fresh session has empty raw text, no entrant pool, and no in-memory draw associations.
- [ ] Persisted draw records contain selected names only; a recursive test confirms no full `Entrant[]` or extra `rawText`/unselected-name data, including when a caller supplies unexpected properties.
- [ ] `saveRecord` rejects inconsistent `DRAWN` slots; does not mutate inputs.
- [ ] `appendEvents` is atomic and append-only, preserves order, and rejects missing records, stale expected lengths, repeated event IDs, and duplicate `DRAWN` events.
- [ ] `listRecords` returns deterministic newest-first results; delete-one and clear-all work.
- [ ] Session actions prevent overwriting an unresolved pool; after completed draws, changing the pool severs previous event/ID associations without deleting history.
- [ ] Reused entrant IDs across a fresh session do not cause exclusions based on old persisted history. Exercise D-020 explicitly.
- [ ] Undo of an earlier session draw after a later draw exists is rejected; undo of the latest active draw remains permitted (D-019).
- [ ] `beforeunload` handler prevents navigation only for unresolved draws; test install, event handling, and cleanup with an injected EventTarget or equivalent.
- [ ] `pnpm verify` and CI pass; no runtime network, no new randomness, no direct `main` changes.

## Required tests
- Use `fake-indexeddb` with distinct test database names and clean teardown; cover repository CRUD, order, transaction conflict, events, corrupted/mismatched draw metadata, and privacy projection.
- Use Zustand store tests for state transitions, new-pool reset, cross-draw undo restriction, and settings serialization/reload. Prove raw entrant data is absent from localStorage.
- Test unload-guard open/closed/undone states, and no-warning after cleanup. Test that history from previous pool/session is never used to exclude current entrants.
- Prefer one realistic `buildDrawRecord()` fixture from T05. No mocked-out database for persistence acceptance tests.

## PR notes
- If completing the entire card requires more than about 400 changed lines excluding lockfile/generated output, explain the excess and keep the scope tight; do not remove critical tests. Stop and ask for a split if implementation becomes materially larger than expected.
- A valid event log and strong privacy boundary matter more than extra abstractions or architectural polish. Note how the same ID `e1` cannot be confused across input pools.
- UI interactions and cross-tab synchronization may require further work in T07/T08; document any known limitation without implementing them here.
