# HANDOFF.md

Read this first after any planner or session change. Sections marked (Codex) are edited by Codex in PRs. Sections marked (Planner) are edited by the planner via a Planner Update Package (docs/PLANNER_PROTOCOL.md).

## Meta (Planner)
- Last updated: 2026-11-13
- Active planner: ChatGPT
- Planner log:
  - 2026-11-13 Claude: kickoff, plan, kit written.
  - 2026-11-13 ChatGPT: reviewed T02-T05, confirmed T05 merge (#6); drafted D-018 through D-021, merge policy update, and T06 ready card.
  - 2026-11-13 ChatGPT: confirmed PR #7 merge; accepted T06 split per D-022; drafted sequenced T06a/T06b cards and gated T07.
  - 2026-11-13 ChatGPT: verified T06a merge (#9, ecc56792); prepared T06b activation after confirming D-022 dependency gate.

## Project snapshot (Planner)
Offline-first giveaway winner picker. React + Vite + TS + Tailwind, Zustand, Dexie, Matter.js, SheetJS. Engine-first build; animation is a replay of a precomputed secure-RNG result. Repo is source of truth. See PLAN.md, ARCHITECTURE.md, DECISIONS.md.

## Current state (Codex)
- Merged: T01 (#1), T02 (#3), T03 (#4), T04 (#5), T05 (#6), T06a (#9).
- In review: none.
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
| T06b | Session, settings, history store, unload guard | ready | |
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
- Next actions: review and merge this T06b activation docs-sync PR, then dispatch `docs/tasks/T06b-store-session.md`. T07 remains a stub until T06b merges and its own card is expanded.
- Pending decisions: hosting target and Vite `base` before T16 (D-017). D-022 is merged; this package activates T06b without introducing a new architectural decision.
- Review queue: T06b activation docs-sync PR when opened; no T06b implementation PR yet.
- Watch: T06b reused entrant IDs/pool generation, cross-draw undo, settings privacy whitelist, persistence-first history actions, native IndexedDB errors, and leave guard. Preserve the `scripts/setup-github.mjs` local edit and the existing PROMPTS stash. Future tooling: include reviewed SHA in `pnpm pr-bundle` output (PR #7 review note).

## Questions from Codex (Codex)
Resolved: T06a merged (#9); T06b becomes ready when this planner docs-sync PR merges. Do not start T07 before both T06a and T06b are done.
