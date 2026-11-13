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
- Merged: nothing yet.
- Open PRs: none.
- Toolchain versions (fill in T01): Node __, pnpm __, Vite __, React __, TypeScript __, Tailwind __, Vitest __, Playwright __.
- Chosen fonts (fill in T01): display __, mono __.
- Known issues: none.

## Task index (Codex updates status)
| ID | Title | Status | PR |
|---|---|---|---|
| T01 | Scaffold, tooling, CI | ready | |
| T02 | Engine: normalize, paste, dedupe | ready | |
| T03 | Engine: rng, draw | ready | |
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
