---
id: T02
title: Engine: normalize, paste, dedupe
status: ready
depends_on: [T01]
branch: codex/T02-engine-normalize-dedupe
---
# T02 Engine: normalize, paste, dedupe

## Goal
Pure functions that turn pasted or imported text into a clean entrant list with stats.

## Read first
ARCHITECTURE section 3 (types, normalize, paste, dedupe rules); `src/engine/AGENTS.md`; DECISIONS D-002.

## Scope
- `src/engine/types.ts` (all types in ARCHITECTURE section 3 that are listed there, including `Entrant`, `RandomSource`, `DrawConfig`, `DrawResult`, `BuildStats`, `BuildResult`).
- `src/engine/normalize.ts`, `paste.ts`, `dedupe.ts`, colocated `*.test.ts`.
- `src/engine/index.ts` exports the public API.
- Entrant `id`: stable and unique within a build (`e1`, `e2`, ... in input order).

## Out of scope
RNG, draw, lifecycle, hashing, any UI.

## Spec
Exactly as ARCHITECTURE section 3. Additional edge cases:
- Whitespace includes tabs, NBSP, zero-width space (U+200B), and newlines inside a cell; all collapse to one space or are removed (zero-width removed).
- `"  JOHN   Smith "` and `"john smith"` dedupe to one entrant; display keeps the first occurrence's case: `JOHN Smith`.
- `foldDiacritics: true` makes `"José"` and `"Jose"` dedupe; false keeps them distinct.
- `dedupe: false` keeps duplicates; `stats.duplicatesRemoved` is 0; `duplicates` is empty.
- `duplicates` lists each removed name once with its removed count (first occurrence not counted).
- `blankDropped` counts empty and whitespace-only entries. `rawCount` counts all input entries before any drop.
- `splitPaste("a, b; c\td")` (no newline) returns 4 items. `splitPaste("Smith, John\nDoe, Jane")` returns 2 items.
- `looksTabular` true when more than half of non-empty lines contain a tab.

## Acceptance criteria
- [ ] All edge cases above covered by tests and passing.
- [ ] 100k generated names (with 30% duplicates) build in under 500 ms in a test.
- [ ] Engine has zero imports outside `src/engine` and no DOM globals.
- [ ] `index.ts` is the only import path used in tests of public behavior.

## Required tests
Unit tests per function; property-style test: for any input, `finalCount + duplicatesRemoved + blankDropped === rawCount` when `dedupe` is true.

## PR notes
Review normalization rules against ARCHITECTURE; unicode handling is the risk.
