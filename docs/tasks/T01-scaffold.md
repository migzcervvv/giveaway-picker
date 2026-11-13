---
id: T01
title: Scaffold, tooling, CI
status: in-review
depends_on: []
branch: codex/T01-scaffold
---
# T01 Scaffold, tooling, CI

## Goal
Working empty app with strict tooling, enforced architecture rules, CI, and helper scripts. No product features.

## Read first
AGENTS.md; ARCHITECTURE sections 1, 2, 8, 9, 10; DECISIONS D-009, D-010, D-011, D-012.

## Scope
- `package.json`, `pnpm-lock.yaml`, `.nvmrc` (current Node LTS), `packageManager` field pinned.
- Vite + React + TypeScript strict (`strict`, `noUncheckedIndexedAccess`). Path alias `@/` -> `src/`.
- Tailwind with the theme tokens from ARCHITECTURE section 8 as CSS variables.
- `@fontsource` packages: pick one display serif and one mono; import locally. Record names in HANDOFF.
- ESLint flat config + typescript-eslint, Prettier, `.editorconfig`.
- Vitest + jsdom + Testing Library, one smoke test rendering the app.
- `src/main.tsx`, `src/ui/App.tsx` (placeholder: title "Giveaway Picker" in display font on `--bg`).
- Empty `src/engine/index.ts` (exports nothing yet). Keep the existing nested `AGENTS.md` files untouched.
- Copy `docs/templates/ci.yml` to `.github/workflows/ci.yml`. Job name must be exactly `verify`. Check action majors are current and update if not.
- Extend `.gitignore` (keep existing lines). Production `index.html` includes the CSP from ARCHITECTURE section 10.
- `package.json` scripts: `dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `test:watch`, `verify` (typecheck + lint + test + build), `handoff` (`node scripts/handoff-bundle.mjs`), `pr-bundle` (`node scripts/pr-bundle.mjs`).
- ESLint rules: ban `Math.random` in `src/**`; for `src/engine/**` ban imports of react, react-dom, dexie, zustand, `@/ui`, `@/store`, `@/db`, `@/io`, `@/reveal`, and the globals `window`, `document`, `localStorage`, `sessionStorage`. For `src/reveal/**` ban imports of `@/ui`, `@/store`, `@/db`, `@/io`.
- Update HANDOFF "Toolchain versions" and "Chosen fonts".

## Out of scope
Any engine code, state, DB, PWA, SheetJS, Matter.js, Motion, canvas-confetti, Playwright.

## Acceptance criteria
- [ ] Clean clone: `pnpm install --frozen-lockfile && pnpm verify` passes.
- [ ] CI runs on the PR and job `verify` is green.
- [ ] Temporarily adding `Math.random()` in `src/` makes `pnpm lint` fail (demonstrate in PR text; do not commit it).
- [ ] Temporarily importing `react` inside `src/engine/` makes `pnpm lint` fail (same).
- [ ] No network URLs in built output (`dist/`), fonts bundled locally.
- [ ] HANDOFF versions and fonts filled in.

## Required tests
Smoke test: app renders the title.

## PR notes
Reviewer will check ESLint rule wiring first.
