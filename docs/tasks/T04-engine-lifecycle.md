---
id: T04
title: Engine: lifecycle, events, undo, pool rules
status: in-review
depends_on: [T03]
branch: codex/T04-engine-lifecycle
---
# T04 Engine: lifecycle, events, undo, pool rules

## Goal
Event-sourced winner lifecycle with backup promotion, undo, and next-draw pool exclusion.

## Read first
ARCHITECTURE section 5; DECISIONS D-006; `src/engine/AGENTS.md`.

## Scope
- `src/engine/lifecycle.ts`, `pool.ts`, colocated tests; export from `index.ts`: `Slot`, `DrawEvent`, `SlotStatus`, `deriveState`, `applyAction`, `slotsFromResult`, `eligiblePool`.
- `slotsFromResult(result)`: winners get ranks 1..N role `winner`; backups get ranks N+1..N+M role `backup` (display "Backup 1..M").
- `applyAction(events, action, now, newId)` where `Action` is `{type:'CALLED'|'NO_SHOW', rank}` or `{type:'UNDO'}`; returns the events to append (including derived PROMOTED/EXHAUSTED). Pure: `now` and `newId` are injected.
- `eligiblePool(allEntrants, drawsEvents: readonly (readonly DrawEvent[])[], opts: { removeCalled: boolean })` implements D-006 and returns the entrants allowed in the next draw.

## Out of scope
Persistence, UI, hashing.

## Spec
- Initial derived state after `DRAWN`: winners `pending`, backups `standby`.
- `CALLED` allowed only on `pending` or `promoted` slots; else throw `LifecycleError('INVALID_TRANSITION')`.
- `NO_SHOW` on a `pending` or `promoted` slot: that slot becomes `no_show`; append `PROMOTED{backupRank, replacesRank}` for the lowest-rank `standby` backup; if none, append `EXHAUSTED{replacesRank}`.
- A promoted backup behaves as a pending winner (can be called or no-show, which promotes the next backup).
- `UNDO`: targets the latest non-undone event other than `DRAWN`; appends `UNDONE{targetEventId}`; derived state ignores the target and any PROMOTED/EXHAUSTED caused by it. Undo with nothing to undo throws `LifecycleError('NOTHING_TO_UNDO')`. Undoing an undo is not supported.
- The log is append-only; functions never mutate the input array.

## Acceptance criteria
- [ ] Table-driven tests for each transition including invalid ones.
- [ ] Chain test: 2 winners, 3 backups; both winners no-show, promoted backup no-shows, backups exhausted; derived state correct at each step.
- [ ] Undo test: undo of NO_SHOW restores winner `pending` and returns the promoted backup to `standby`.
- [ ] Pool rule tests for D-006 including `removeCalled` true/false, multiple open draws, and no-show exclusion.
- [ ] Derived state is a pure function of events (same events, same output).

## Required tests
As above.

## PR notes
Review the undo derivation; it is the most error-prone part.
