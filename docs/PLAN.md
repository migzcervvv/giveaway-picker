# PLAN.md (planner-owned)

## 1. Product
Offline-first giveaway winner picker. Static site, no backend. Entrant data never leaves the browser.

## 2. Requirements

### Input
- Paste box: one name per line. Single-line paste also splits on tab, semicolon, comma.
- File import: xlsx/csv -> sheet selector -> column picker with first-rows preview and header detection. Parsing in a Web Worker.
- Normalization: trim, collapse whitespace, case-insensitive dedupe, optional diacritic folding.
- Summary: rows read, blanks dropped, duplicates removed (listed in session UI), final entrant count.

### Draw config
- N winners, M ordered backups (backup 1, 2, 3...).
- Modes: all at once, or one at a time.
- Toggle: dedupe on/off. Toggle: remove called winners from the pool.

### Winner lifecycle
- Winner: `pending` -> `called` | `no_show`. Backup: `standby` -> `promoted` (takes a no-show's place, in order).
- Event log with undo. See ARCHITECTURE section 5.

### Log and record
- IndexedDB history of draws (no raw entrant names). SHA-256 of normalized entrant list per draw.
- Export: JSON, CSV, xlsx. "Clear all data" button.

### Reveal (primary feature)
- Three modes, all replaying a precomputed result: Raffle drum (default), Slot reel, Name wheel (small lists).
- Suspense arc: spin-up, deceleration with ticks, selection, ejection, unfold, confetti, spotlight.
- Live HUD: entrant counter, current contender highlight, winner slots filling in.
- Skip, mute, reduced-motion fallback.
- Winner screen: full-bleed editorial typography, rank badge, Mark called / No-show inline.

### Non-goals (v1)
Accounts, backend, social-platform scraping, PDF export, analytics, multi-language UI.

## 3. Stack
| Concern | Choice | Notes |
|---|---|---|
| Package manager | pnpm | via corepack; `packageManager` pinned |
| Build | Vite + React + TypeScript (strict) | latest stable at T01, pinned exact |
| Styling | Tailwind CSS | v4 with `@tailwindcss/vite` unless incompatible |
| UI motion | Motion (package `motion`, import from `motion/react`) | reveals, unfold, HUD |
| Physics | Matter.js on canvas | decoration only |
| Confetti | canvas-confetti | |
| State | Zustand | |
| Local DB | Dexie (IndexedDB) | |
| Spreadsheets | SheetJS | install from SheetJS CDN tarball at an exact version (npm `xlsx` is stale). T10 only. |
| Fonts | `@fontsource/*` | display serif + mono, self-hosted |
| PWA | vite-plugin-pwa | T16 |
| Tests | Vitest, Testing Library, Playwright | |
| Lint/format | ESLint (flat), typescript-eslint, Prettier | |
| Hosting | static (Vercel/Netlify/GitHub Pages) | |

## 4. Phases and tasks
| Phase | Tasks |
|---|---|
| 0 GitHub + kit | `docs/SETUP.md` (owner) |
| 1 Scaffold | T01 |
| 2 Engine | T02 normalize/dedupe, T03 rng/draw, T04 lifecycle, T05 hash/record |
| 3 State + core UI | T06 store/db, T07 input UI, T08 draw flow + plain reveal, T09 history + export |
| 4 Import | T10 xlsx/csv |
| 5 Reveal | T11 framework + audio + RevealLab, T12 drum, T13 reel, T14 wheel, T15 winner screen polish |
| 6 Ship | T16 PWA, T17 a11y + e2e + perf |
| v2 | V2-01 Google Sheets (Picker, `drive.file` scope; avoid `spreadsheets.readonly` and `drive.readonly`, which require verification) |

Cards T01-T05 are done; T06 is ready following this planner docs-sync merge. Later cards are `stub`; the planner expands a stub into a `ready` card just before dispatch.

## 5. v1 definition of done
All of T01-T17 merged; works fully offline after first load (installable PWA); 100k-name paste handled without UI freeze; engine invariants tested; no network requests at runtime (verified by Playwright); animation modes run at 60 fps on a mid-range laptop; reduced-motion path works.
