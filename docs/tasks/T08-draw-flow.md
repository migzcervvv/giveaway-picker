---
id: T08
title: Draw flow, plain reveal, winner actions
status: in-review
depends_on: [T07a, T07b]
branch: codex/T08-draw-flow
---

# T08 — First playable raffle (planner-approved implementation card)

> **Activation:** The planner supplies this replacement card in PR #19's review handoff. After PR #19 is merged, Codex creates `codex/T08-draw-flow` from updated `main`, replaces the existing stub with this card **as the first task action**, then implements T08 in the **same implementation PR**. No status-only/docs-only PR. Changing the card to `in-review` and HANDOFF Codex sections belongs in that PR. Do not begin implementation until PR #19 is merged and this card is on the task branch.

## Goal
Deliver the first end-to-end, unanimated, keyboard-operable raffle: use the existing entered list and draw settings to select winners and ordered backups via the secure engine, persist a DrawRecord, show the predetermined results, and record CALLED / NO_SHOW / UNDO with correct promotion and cross-round exclusions.

## Read first
`AGENTS.md`, `docs/ARCHITECTURE.md` sections 3–6, 8, 10; `docs/DECISIONS.md` D-001, D-003, D-006, D-012, D-018–D-021, D-023–D-025; `src/engine/{draw,pool,lifecycle,record}.ts`, `src/store/{session,history,settings,drawConfig}.ts`, `src/ui/{App.tsx,screens/InputScreen.tsx}`. Issue #16 fix must already be merged.

## Scope (focused, expected ≤500 non-test changed lines)
- Add a small testable draw-flow orchestrator in `src/store/drawFlow.ts` (or similarly named store module) using the existing engine and stores. Dependency-inject stores and clock/id/RNG as needed for tests; no new global framework.
- Add `src/ui/screens/WinnersScreen.tsx` with a plain result/slot-status view and actions.
- Wire draw/prepare/navigation in `src/ui/App.tsx` and `src/ui/screens/InputScreen.tsx`. Reuse Button, Switch, Section, Stepper.
- Strengthen `src/store/session.ts`: on replacing an existing draw, reject any change that truncates or rewrites previously registered events; new events must extend the old event sequence. Preserve registration order, immutable record identity/pool invariants and D-019 undo restriction. Test it.
- Colocated orchestrator/UI/session regression tests. Update this task's status and HANDOFF's Codex-owned current state.
- No animation, routing, imports/exports, history screen, sound, new dependency or engine/db modification. If 500 non-test lines is exceeded, stop at a clean boundary and report rather than silently enlarging scope.

## Selection and persistence contract
1. On Draw, require a completed/current session build and unchanged input (no pending debounce). Compute `eligiblePool(build.entrants, session.draws.map(d => d.events), {removeCalled: settings.removeCalled})` **from current pool-generation draws only**. Never attach persisted history events to a new pool by entrant ID or list hash (D-020).
2. Show the eligible count. If none are eligible, disable Draw with a readable explanation. Winner/backup values must be clamped against **eligible count**, not merely total input size, through the memory-only `drawConfigStore` (D-025); show when values were adjusted. Never silently select more people than eligible.
3. Snapshot generation, build, current preferences and effective draw counts. Use engine `draw(eligible, {winners,backups})` with `cryptoSource` for all selection, **before** any UI reveal; no `Math.random` and no result re-selection by UI. Use secure RNG surface for unique record/event IDs (or an injected deterministic ID factory in tests).
4. Create `DRAWN` event using `slotsFromResult`; build record with `buildDrawRecord` using the original full normalized entrant list and its stats for the list hash. Record settings are `dedupe`, `foldDiacritics`, `removeCalled` plus exact selected winners/backups.
5. **Persist first** with `history.save(record)`; only after success register via `session.setDraw(record, generation)` and show winners. Disable concurrent submissions/actions while busy. Hide/unmount or otherwise block input changes during an in-flight draw. Recheck generation before persistence and before session registration; if external pool generation changes despite UI safeguards, do not attach stale draw or exclude entrants in the new pool. Report any partial persisted-but-detached result accurately, rather than pretending it failed to save.
6. For CALLED / NO_SHOW / UNDO, use `session.prepareAction(drawId, action, now, newId)` (not direct UI event fabrication). Append with `history.append(drawId, newEvents, expectedEventCount)`; only after persistence succeeds call `session.setDraw(updatedRecord, originalGeneration)`. On persistence failure leave in-memory draw unchanged and show a retryable error. Serialize or block overlapping mutations. Preserve returned PROMOTED/EXHAUSTED dependent events and append-only logs.
7. Ensure D-019: only latest registered draw permits UNDO, but earlier in-session draws may receive allowed CALLED/NO_SHOW actions. No direct historical-record actions after reload in T08; T09 owns history access and must not link old entrant IDs to a new pool. T08 need not decide T09's full archived-record interaction policy.

## Plain UI
- Input view: visible **Draw** control, eligible count and explanation when empty or input/build is pending. Draw disabled unless build is current, complete and eligible. Add the persisted `oneAtATime` preference switch (already in settings whitelist) without changing settings schema.
- While drawing/saving: an accessible “Preparing draw…” state and disabled input/double-click path; clear error on retry.
- Winner view: draw identifier/time, winner slots by rank, backup slots in order, status labels, visible called/no-show actions for pending/promoted slots, and an UNDO action enabled only for the latest draw where an undo is applicable. A NO_SHOW must visibly promote the next standby backup or show that no backup remains. Show current-pool in-session draws so the user can view/resolve earlier open draws; do not make their actions inaccessible.
- One-at-a-time: still preselect and persist **all** names up front, but reveal one slot at a time with Next; do not render not-yet-revealed names anywhere in visible or accessible DOM. In all-at-once mode show all. A promoted backup needed by an action must become visible. Announce newly revealed winners and status changes with `aria-live`, without overwhelming repeated announcements.
- Return to input/Next round without discarding earlier draws; unresolved draw locks text and rebuild toggles via existing T07a/T07b behavior, but eligible unaffected entrants may still be drawn in later rounds. No decorative animation in T08.
- Names are React text, never `innerHTML`; no runtime network calls, persisted raw input, or unsafe log statements.

## Required tests
- Draw success with deterministic injected RNG/IDs: engine result equals displayed/persisted result; record hash and config are correct; persistence occurs before session registration/UI reveal.
- Double-click while busy, save failure and retry, stale pool-generation while async hashing/persisting, empty pool and insufficient eligible pool. Failures never falsely update session or show winners.
- CALLED, NO_SHOW + lowest standby PROMOTED, NO_SHOW with EXHAUSTED, UNDO latest only; verify appendEvents expectedCount, error rollback and no duplicate/lost events.
- At least one real IndexedDB repository integration (fake-indexeddb) multi-round scenario: called excluded when removeCalled=true, no-show always excluded, pending/promoted excluded, standby released after draw resolves, and removeCalled=false permits called when otherwise eligible. Confirm session generation isolation.
- Regression for session replacement accepting exact extension but rejecting altered prefix/truncation, while maintaining registration order.
- Input dirty debounce cannot start a stale draw; one-at-a-time hides unrevealed names, Next reveals in rank order, aria-live announcements, keyboard actions, earlier draw navigation; reduced-motion path is plain (no effects). Include UI tests with injected stores.
- `pnpm verify` and required GitHub CI pass. PR description must report non-test/test line counts (D-023).

## Review focus
Correctness of persistence-first ordering, generation/stale work, selection fairness and eligible-pool exclusion, undo-order, no premature reveal, accessibility and privacy. The only remaining track after T08 is richer animation/history/import work; **do not block the first playable raffle on unrelated polish**.
