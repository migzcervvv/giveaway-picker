# AGENTS.md

Project: Giveaway Picker. Offline-first winner picker. Owner: Miggz.
Roles: Planner (Claude or ChatGPT, interchangeable) writes plans and reviews PRs. Codex (you) implements one task card per PR. Owner merges.
Source of truth: this repository. Chat history is not.

## Start of every task
1. Read this file.
2. Read `docs/HANDOFF.md` (what is merged, open PRs, open questions).
3. Read your task card in `docs/tasks/`. Start only cards with `status: ready`. Never start a `stub`.
4. Read the `docs/ARCHITECTURE.md` sections the card references and any `docs/DECISIONS.md` IDs it cites.
5. Read the nested `AGENTS.md` of every directory you edit (`src/engine/`, `src/reveal/`).

## Product
Paste or import names (xlsx/csv with column picker), normalize and dedupe, draw N winners + M ordered backups with a cryptographically secure RNG, play a lot-drawing animation of the precomputed result, track called/no-show, log history locally, export a draw record. Entrant data never leaves the browser.

## Hard rules (violations are blocking review findings)
1. Outcome first, animation second. Winners are computed by `src/engine` before any animation starts. Animation code never selects, reorders, or influences winners.
2. All randomness goes through `src/engine/rng.ts` (`crypto.getRandomValues`, rejection sampling, Fisher-Yates). `Math.random` is banned everywhere in `src/` (ESLint). Cosmetic randomness uses `src/reveal/cosmetic.ts`, which wraps the engine RNG.
3. No runtime network access. No analytics, CDN scripts, CDN fonts, remote images, or third-party fetch. Fonts are self-hosted via `@fontsource/*`. Sole future exception: Google Sheets import (v2), opt-in, own task card.
4. Raw entrant names are not persisted by default. IndexedDB stores draw records only: winners, backups, counts, SHA-256 of the normalized entrant list, event log.
5. `src/engine` is pure TypeScript: no React, DOM, Dexie, Zustand, or I/O. Enforced by ESLint.
6. Dependencies: add only what the task card or `docs/PLAN.md` lists. Pin exact versions. Anything else: ask in the PR, do not add.

## Workflow
- One task card = one branch = one PR. Branch: `codex/<TaskID>-<slug>` from latest `main`.
- Never push to `main`. Never merge your own PR. After review starts, add commits; do not force-push or rewrite history.
- Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`).
- Before opening a PR: `pnpm verify` passes (typecheck, lint, test, build).
- Open the PR ready for review using `.github/pull_request_template.md`. Fill every section. Paste real command output under Verification. Add label `planner-review`.
- In the same PR: update the task card `status` and the "Current state" section of `docs/HANDOFF.md`.
- You own code, tests, task-card `status`, and HANDOFF "Current state". The planner owns `docs/PLAN.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, task card bodies, and HANDOFF "Planner notes". Do not edit planner-owned content; propose changes under "Questions for planner" in the PR.
- Ambiguity or conflict with the card: take the smallest safe interpretation, record it under "Deviations" in the PR. Do not redesign. Do not expand scope.
- Size limit: about 400 changed lines per PR excluding lockfiles and generated files. If the task exceeds it, stop at a clean boundary, open the PR, and note the split in "Questions for planner".

## Commands
```
pnpm install --frozen-lockfile
pnpm dev
pnpm verify        # typecheck + lint + test + build. Required green before PR.
pnpm test | test:watch | lint | typecheck | build
pnpm handoff       # writes handoff-bundle.md (gitignored)
pnpm pr-bundle <n> # writes pr-<n>-bundle.md (gitignored)
```

## Layout and dependency direction
```
src/engine/   pure logic            (imports nothing from other src dirs)
src/io/       parsers, export, workers   -> engine
src/db/       Dexie schema, repos        -> engine types
src/store/    Zustand                     -> engine, db
src/reveal/   animation modes, audio      -> engine types only
src/ui/       React components/screens    -> store, reveal, io
src/dev/      RevealLab and demo harness  -> reveal
```
Violating the arrows is a blocking finding. Details: `docs/ARCHITECTURE.md`.

## Standards
- TypeScript strict, `noUncheckedIndexedAccess`. No `any`, no non-null assertions without a comment.
- Named exports. Files under ~300 lines. Tests colocated as `*.test.ts(x)`.
- Accessibility: keyboard operable, visible focus, winners announced via `aria-live`, `prefers-reduced-motion` respected.
- No placeholder or fake data in shipped code outside `src/dev/`.

## Definition of done
Acceptance criteria in the card all met and ticked in the PR; `pnpm verify` green; CI green; scope respected; docs and status updated.

## Code Review Rules
Apply when reviewing PRs in this repository.
- Flag `Math.random`, or any RNG use outside `src/engine/rng.ts` and `src/reveal/cosmetic.ts`.
- Flag any import in `src/engine` of react, react-dom, dexie, zustand, or DOM globals.
- Flag any network request, CDN URL, or external font/script/image.
- Flag any persistence of raw entrant names.
- Flag animation code that chooses, reorders, or filters winners.
- Flag engine changes without tests, or tests that only assert on mocks.
- Flag files changed outside the task card scope.
- Flag lifecycle or pool-rule changes that contradict `docs/DECISIONS.md`.
