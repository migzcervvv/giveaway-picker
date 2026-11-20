# HANDOFF.md

Read this first after any planner or session change. Sections marked (Codex) are edited by Codex in PRs. Sections marked (Planner) are edited by the planner via a Planner Update Package (docs/PLANNER_PROTOCOL.md).

## Meta (Planner)
- Last updated: 2026-11-19
- Active planner: ChatGPT
- Planner log:
  - 2026-11-13 Claude: kickoff, plan, kit written.
  - 2026-11-13 ChatGPT: reviewed T02-T05, confirmed T05 merge (#6); drafted D-018 through D-021, merge policy update, and T06 ready card.
  - 2026-11-13 ChatGPT: confirmed PR #7 merge; accepted T06 split per D-022; drafted sequenced T06a/T06b cards and gated T07.
  - 2026-11-13 ChatGPT: verified T06a merge (#9, ecc56792); prepared T06b activation after confirming D-022 dependency gate.
  - 2026-11-19 Claude: took over from ChatGPT via handoff bundle; reviewed T06b (#11) APPROVE and setup-github fix (#13) APPROVE; added D-023 to D-025; split T07 into T07a/T07b.
  - 2026-11-19 ChatGPT: resumed planning; requested PR #14 corrections to locked text-edit behavior and immediate invalidation of pending build results.

## Project snapshot (Planner)
Offline-first giveaway winner picker. React + Vite + TS + Tailwind, Zustand, Dexie, Matter.js, SheetJS. Engine-first build; animation is a replay of a precomputed secure-RNG result. Repo is source of truth. See PLAN.md, ARCHITECTURE.md, DECISIONS.md.

## Current state (Codex)
- Merged: T01 (#1), T02 (#3), T03 (#4), T04 (#5), T05 (#6), T06a (#9), T06b (#11), T07a (#17), T07b (#18), Issue #16 (#19), T08 (#20), T09 (#21), T10a (#22), T10b (#23), UX01 (#24), UX02 (#25), UX03 (#26).
- UX04 merged (#28). In review: UX05 restart and reset. UX06 and UX07 are ready after their prerequisite merges.
- Toolchain versions: Node 26.13.1, pnpm 12.18.0, Vite 8.3.8, React 19.3.1, TypeScript 6.0.3, Tailwind 4.3.5, Vitest 5.1.0. Playwright is deferred.
- Chosen fonts: Instrument Serif (display), IBM Plex Mono (mono).
- Known issues: none.

## Task index (Codex updates status)
| ID | Title | Status | PR |
|---|---|---|---|
| T01 | Scaffold, tooling, CI | done | #1 |
| T02 | Engine: normalize, paste, dedupe | done | #3 |
| T03 | Engine: rng, draw | done | #4 |
| T04 | Engine: lifecycle, events, undo | done | #5 |
| T05 | Engine: hash, record | done | #6 |
| T06 | Store + Dexie history (split umbrella; non-executable) | stub | |
| T06a | IndexedDB history schema and repository | done | #9 |
| T06b | Session, settings, history store, unload guard | done | #11 |
| T07 | App shell, theme, input UI (split umbrella; non-executable) | stub | |
| T07a | List build runner, draw-config store, useListBuilder hook | done | #17 |
| T07b | App shell, theme primitives, input screen (gated on T07a) | done | #18 |
| T08 | Draw flow, plain reveal, winner actions | done | #20 |
| T09 | History view + exports | done | #21 |
| T10 | Spreadsheet import (non-executable umbrella) | stub | |
| T10a | Import worker | done | #22 |
| T10b | Import picker UI | done | #23 |
| UX01 | Operator interface | done | #24 |
| UX02 | Audience stage | done | #25 |
| UX03 | Card reveal | done | #26 |
| UX04 | Manage revealed winners | done | #28 |
| UX05 | Restart and reset | in-review | |
| UX06 | Shuffle and batches | ready | |
| UX07 | Standby, replay and pause | ready | |
| T11 | Reveal framework, audio, RevealLab | stub | |
| T12 | Raffle drum | stub | |
| T13 | Slot reel | stub | |
| T14 | Name wheel | stub | |
| T15 | Winner screen polish | stub | |
| T16 | PWA offline | stub | |
| T17 | a11y, e2e, perf | stub | |
| V2-01 | Google Sheets import | stub | |

## Planner notes (Planner)
- Next actions: merge this docs-sync PR, then dispatch `docs/tasks/T07a-build-runner.md`. T07b is spec-complete but `stub` until T07a merges; the planner then flips it to `ready`.
- Pending decisions:
  - P-1 resolved by D-026: persisted history is read-only; archived draws may be viewed, exported, or deleted. CALLED/NO_SHOW/UNDO remain in the current-session T08 flow. Archived IDs/hashes never attach to a new pool.
  - D-017: hosting target and Vite `base`, before T16.
- Review queue: none.
- Watch (carry into cards):
  - T08: `session.setDraw` accepts any record for the current generation; add a prefix check (new events must extend the stored draw's events) when wiring. `history.remove` and `history.clear` do not touch the session; detach or block draws deleted from history.
  - T07b: the paste box and rebuild toggles must use `hasUnresolvedDraw`, not catch thrown errors.
  - Next store-touching PR: add (a) a history ordering test (3 records, two with equal `createdAt`; order after `load()` equals order after sequential saves) and (b) an overlapping-operations test for the history queue and `loading` flag.
  - T17: add `format:check` to `verify`; Prettier-normalize `scripts/`; split tsconfig so Node globals are not typed in browser code; consider Vitest pool settings (jsdom is recreated per file).
  - Tooling backlog: include the reviewed head SHA in `pnpm pr-bundle` output (PR #7 note).
  - D-016 pins pnpm 12.18.0; 12.21.0 exists. Bump only through a task PR.

## Questions from Codex (Codex)
None. T06b merged (#11).
