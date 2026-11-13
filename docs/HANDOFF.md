# HANDOFF.md

Read this first after any planner or session change. Sections marked (Codex) are edited by Codex in PRs. Sections marked (Planner) are edited by the planner via a Planner Update Package (docs/PLANNER_PROTOCOL.md).

## Meta (Planner)
- Last updated: 2026-11-13
- Active planner: ChatGPT
- Planner log:
  - 2026-11-13 Claude: kickoff, plan, kit written.
  - 2026-11-13 ChatGPT: reviewed T02-T05, confirmed T05 merge (#6); drafted D-018 through D-021, merge policy update, and T06 ready card.
  - 2026-11-13 ChatGPT: confirmed PR #7 merge; accepted T06 split per D-022; drafted sequenced T06a/T06b cards and gated T07.

## Project snapshot (Planner)
Offline-first giveaway winner picker. React + Vite + TS + Tailwind, Zustand, Dexie, Matter.js, SheetJS. Engine-first build; animation is a replay of a precomputed secure-RNG result. Repo is source of truth. See PLAN.md, ARCHITECTURE.md, DECISIONS.md.

## Current state (Codex)
- Merged: T01 (#1), T02 (#3), T03 (#4), T04 (#5), T05 (#6).
- In review: T06a on codex/T06a-db-history.
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
| T06a | IndexedDB history schema and repository | in-review | |
| T06b | Session, settings, history store, unload guard | stub | |
| T07 | App shell, theme, input UI | stub | |
| T08 | Draw flow, plain reveal, winner actions | stub | |
| T09 | History view + exports | stub | |
| T10 | xlsx/csv import + column picker | stub | |
| T11 | Reveal framework, audio, RevealLab | stub | |
| T12 | Raffle drum | stub | |
| T13 | Slot reel | stub | |
| T14 | Name wheel | stub | |
| T15 | Winner screen polish | stub | |
| T16 | PWA offline | stub | |
| T17 | a11y, e2e, perf | stub | |
| V2-01 | Google Sheets import | stub | |

## Planner notes (Planner)
- Next actions: docs-sync PR to record D-022 and the T06a/T06b split; after SHA-bound review and approved merge, dispatch only T06a. Once T06a merges, prepare a status-only planner update to mark T06b `ready`, then dispatch T06b. T07 stays a stub until both merge.
- Pending decisions: hosting target and Vite `base` before T16 (D-017). D-022 is proposed in this package and not effective in `main` until the docs-sync PR merges.
- Review queue: T06 split docs-sync PR when opened; no implementation PR opened at the time of split request.
- Watch: T06a privacy allowlisting, exact DRAWN validation and atomic transactions; T06b reused entrant IDs/pool generation, cross-draw undo, no saved roster, and leave guard. `scripts/setup-github.mjs` local edit and the separate PROMPTS stash must remain untouched. A future tooling task should add reviewed SHA to `pnpm pr-bundle` output (PR #7 review note).

## Questions from Codex (Codex)
Resolved: split oversized T06 into T06a and T06b; do not start T06b until T06a merges and planner marks it ready.
