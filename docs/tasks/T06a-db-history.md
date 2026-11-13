---
id: T06a
title: IndexedDB history schema and repository
status: ready
depends_on: [T05]
branch: codex/T06a-db-history
---
# T06a IndexedDB history schema and repository

## Goal
Provide a secure, typed IndexedDB persistence boundary for draw records and append-only draw events. This task is restricted to Dexie and persistence tests. T06b will build state stores on this repository after this PR merges.

## Read first
- `AGENTS.md`; `docs/HANDOFF.md`; `docs/ARCHITECTURE.md` sections 1, 4, 5 and 10.
- `docs/DECISIONS.md` D-003, D-006, D-018, D-020, D-021 and D-022.
- `src/engine/record.ts`, `lifecycle.ts`, `types.ts`, and the public `src/engine/index.ts`.

## Scope (files to create or modify)
- `src/db/schema.ts`: version 1 Dexie database (`draws` table, primary key `id`, index `createdAt`).
- `src/db/repos.ts`: small typed repository with injected database support and one production database instance.
- Colocated `src/db/*.test.ts` covering persistence and transaction behavior with real `fake-indexeddb`.
- `package.json` and `pnpm-lock.yaml`: install exactly pinned `dexie` runtime dependency and `fake-indexeddb` dev dependency. Record actual compatible version numbers in PR description.
- `docs/tasks/T06a-db-history.md`: change only its status to `in-review` in the implementation PR; update `docs/HANDOFF.md` Codex-owned Current state and task index.

## Out of scope
- Zustand, session/settings/history stores, unload guard or `src/main.tsx` (T06b).
- New engine selection/lifecycle business rules, UI, import/export file writing, networking, persisted raw entrant roster, unselected names, schema migrations beyond v1, and cross-tab synchronization.

## Spec
1. Export a `DrawDatabase` (or equivalent) Dexie subclass and an injectable repository factory such as `createDrawRepository(db)`; expose a simple production repository. The storage model is the existing engine `DrawRecord` from T05, **not** a duplicate domain model. The table uses key `id` and indexed `createdAt`.
2. Repository operations: `saveRecord(record)`, `getRecord(id)`, `listRecords()`, `appendEvents(id, appended, expectedEventCount)`, `deleteRecord(id)`, `clearRecords()`. Return records newest-first, breaking identical timestamps by ascending `id` consistently. Deletion of a whole draw and clear-all are allowed; editing individual committed events is not.
3. **Privacy boundary:** project an allowlist of `DrawRecord` scalar fields, `config`, `slots`, and typed `events`. Explicitly reconstruct nested `DRAWN.slots` and each event variant from approved fields. Reject or discard unexpected properties, including nested `entrants`, `rawText`, full rosters, or extra names. Never save full `Entrant[]`, raw paste, or names of unselected entrants. Do not use blind spreads of untrusted record/event objects. No fallback to localStorage.
4. `saveRecord` performs runtime validation: an initial `DRAWN` event is required, its ranked slots must match `record.slots` in order (rank, role, entrantId, name), and event IDs must be unique. Reject inconsistent initial metadata; do not mutate input. Saving is create-only: duplicate record IDs must fail, not overwrite existing events.
5. `appendEvents` is one Dexie read-write transaction. It checks that the record exists, the stored `events.length` equals `expectedEventCount`, appended IDs are unique against both the current log and each other, and no appended event is `DRAWN`. On any failure it rejects with a distinguishable error and commits no partial append; successful batches keep caller order. An empty batch may be treated as a no-op only if the expected count matches. Protect against two competing appends built from the same expected count (only one succeeds).
6. Preserve IndexedDB errors for callers. Project returned records as fresh data: callers must not be able to mutate a cached reference that changes another read. No async crypto work or network requests inside a Dexie transaction. The pure engine remains unchanged.
7. Database/index choice and runtime projectors should remain small and readable. Do not duplicate the engine lifecycle reducer or implement T06b session rules here.

## Acceptance criteria
- [ ] Real `fake-indexeddb` tests prove save/read/list/delete/clear and persistence across reopening a database using the same test name; teardown isolates database names.
- [ ] Records contain selected names and counts/hash but no complete roster, raw paste, or unselected names; recursively inspect persisted data, including caller-supplied nested extra properties.
- [ ] Invalid or mismatched initial `DRAWN` slots and duplicate event IDs are rejected without changing the database. Valid `buildDrawRecord()` fixtures succeed.
- [ ] `saveRecord` is create-only; duplicate ID cannot overwrite an existing record or its events.
- [ ] `appendEvents` preserves order and is atomic; missing record, stale count, repeat IDs (including inside one batch), and new `DRAWN` all reject. A concurrent stale writer does not lose another transaction's events.
- [ ] `listRecords` sorts newest-first with a deterministic tie-break by `id`; returned values do not expose mutable shared repository state.
- [ ] Engine imports remain isolated; no persisted entrant roster, new randomness, or runtime network access.
- [ ] `pnpm verify` and GitHub CI pass.

## Required tests
- Use `fake-indexeddb` itself, not a mocked persistence API. Create distinct test databases and clean up after each test.
- Cover valid `buildDrawRecord()` round-trip, malformed/corrupted input, allowlist projection through the actual DB read, timestamp ties, duplicate IDs, stale count, concurrent append, failed-transaction rollback, and delete/clear.
- Verify input immutability and that saving a crafted object with unexpected nested fields cannot persist those fields.

## Verification
`pnpm verify` (typecheck, lint, test, build). Review GitHub `verify` check for the exact submitted head SHA.

## PR notes
- One task, one PR. Report pinned dependency versions and any deviations. Preserve the user's existing local edits and stash; use a separate worktree if needed.
- Do not implement T06b early or merge your own PR without planner SHA-bound approval and delegated execution under D-021.
- The reviewer will inspect the allowlist, event-log immutability, and transaction concurrency checks before approving.
