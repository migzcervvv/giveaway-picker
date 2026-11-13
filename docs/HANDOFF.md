# HANDOFF.md

Read this first after any planner or session change. Sections marked (Codex) are edited by Codex in PRs. Sections marked (Planner) are edited by the planner via a Planner Update Package (docs/PLANNER_PROTOCOL.md).

## Meta (Planner)
- Last updated: 2026-11-13
- Active planner: Claude
- Planner log:
  - 2026-11-13 Claude: kickoff, plan, kit written.

## Project snapshot (Planner)
Offline-first giveaway winner picker. React + Vite + TS + Tailwind, Zustand, Dexie, Matter.js, SheetJS. Engine-first build; animation is a replay of a precomputed secure-RNG result. Repo is source of truth. See PLAN.md, ARCHITECTURE.md, DECISIONS.md.

## Current state (Codex)
- Merged: T01 (#1), T02 (#3)
- In review: T03 on `codex/T03-engine-rng-draw`.
- Toolchain versions: Node 26.13.1, pnpm 12.18.0, Vite 8.3.8, React 19.3.1, TypeScript 6.0.3, Tailwind 4.3.5, Vitest 5.1.0. Playwright is deferred.
- Chosen fonts: Instrument Serif (display), IBM Plex Mono (mono).
- Known issues: none.

## Task index (Codex updates status)
| ID | Title | Status | PR |
|---|---|---|---|
| T01 | Scaffold, tooling, CI | done | #1 |
| T02 | Engine: normalize, paste, dedupe | done | #3 |
| T03 | Engine: rng, draw | in-review | |
| T04 | Engine: lifecycle, events, undo | ready | |
| T05 | Engine: hash, record | ready | |
| T06 | Store + Dexie history | stub | |
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
- Next actions: dispatch T01. After T01 merges, dispatch T02-T05 in order (each depends on the previous).
- Pending decisions: none.
- Review queue: none.

## Questions from Codex (Codex)
None.
