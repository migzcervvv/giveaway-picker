---
id: T07b
title: App shell, theme primitives, input screen
status: stub
depends_on: [T07a]
branch: codex/T07b-input-ui
---
# T07b App shell, theme primitives, input screen

Spec complete. The planner flips `status` to `ready` after T07a merges (D-022 precedent). Codex must not start this card while it is `stub`.

## Goal
The first usable screen: paste or type names, see the cleaning summary, set winners, backups and toggles. No draw yet (T08).

## Read first
AGENTS.md; ARCHITECTURE sections 8 and 10; DECISIONS D-002, D-003, D-018, D-023, D-025; the T07a outputs (`useListBuilder`, `drawConfigStore`) plus `settingsStore` and `sessionStore`.

## Scope
- `src/ui/App.tsx` (shell), `src/ui/screens/InputScreen.tsx`
- `src/ui/components/Button.tsx`, `Switch.tsx`, `Stepper.tsx`, `Section.tsx`
- `src/ui/theme.css`: tokens already exist; add only the focus ring and layout utilities
- colocated tests
- Codex-owned updates: this card's `status`, HANDOFF "Current state"

## Out of scope
Draw button or any draw logic, routing, history UI, file import (T10), reveal, sound, theme toggle, PWA, new dependencies, sample or placeholder names in shipped code.

## Spec

Shell. Skip link to the main content. Header with the wordmark "Giveaway Picker" in the display font and the subtitle "Runs on this device. Nothing is uploaded." Landmarks: header and main. Dark editorial look per ARCHITECTURE section 8: generous spacing, display serif for headings, mono for data and counts. Layout: one column below 768 px; from 768 px, entrants on the left and summary plus settings on the right. Respect `prefers-reduced-motion` (no transitions when reduced).

Entrants panel.
- `<textarea>` with a visible `<label>` "Entrants", `spellCheck={false}`, `autoComplete="off"`, `autoCorrect="off"`, `autoCapitalize="off"`. Placeholder is generic instruction text: "Paste names, one per line". Value and handlers come from `useListBuilder`. Paste events commit immediately (`immediate: true`); typing is debounced.
- Buttons: "Paste from clipboard", rendered only when `navigator.clipboard?.readText` exists; on rejection show inline "Clipboard access was blocked. Press Ctrl+V in the box." And "Clear".
- When `locked`: textarea read-only, Clear disabled, message "Mark every winner as called or no-show before changing the list." linked via `aria-describedby`.
- When `looksTabular(text)` is true, show "Several columns detected. Each line is used as one name, including text after the tab." (The column picker arrives with file import.)

Summary panel (`role="status"`, `aria-live="polite"`).
- States: empty ("No names yet"), building ("Building list…"), ready, error (message from the hook).
- Ready shows rows read, blanks dropped, duplicates removed, final entrants, formatted with `Intl.NumberFormat`.
- `<details>` "Removed duplicates" lists up to 200 entries as `name × count`, then "+N more". React text nodes only.
- "First 5 names" preview from `build.entrants`.

Settings panel.
- Steppers: Winners (minimum 1) and Backups (minimum 0), driven by `drawConfigStore` and clamped with `build.stats.finalCount`; re-clamp when the pool size changes. Show helper text when a value was clamped.
- Switches: "Remove duplicate names" (`dedupe`), "Ignore accents when comparing" (`foldDiacritics`), "Remove winners from the pool after they are called" (`removeCalled`). While `locked`, the first two are disabled with an explanation; `removeCalled` stays enabled.

Accessibility: every control has an accessible name; visible focus ring using `--accent`; targets at least 40 px; text contrast on `--bg` and `--surface` at least 4.5:1; counts are never conveyed by color alone.

Privacy: names render as text only (no `innerHTML`); nothing is written to storage except the settings whitelist.

## Acceptance criteria
- [ ] Pasting text shows the summary figures and the first-5 preview.
- [ ] Toggling dedupe or accents updates the summary.
- [ ] Steppers clamp at pool size; backups never exceed pool minus winners.
- [ ] Locked state disables the textarea, Clear and the two rebuild toggles, with the explanation announced.
- [ ] A name like `<img src=x onerror=alert(1)>` renders as text and creates no `<img>` element.
- [ ] The duplicate list is capped at 200 with a "+N more" line.
- [ ] Keyboard only: all controls reachable in a sensible order; Switch toggles with Space; Stepper operable.
- [ ] localStorage holds only the settings whitelist after typing names.
- [ ] Owner manual check, reported by the owner: run `copy(Array.from({length:100000},(_,i)=>'Name '+(i%70000)).join('\n'))` in DevTools and paste into the box. Expect 100,000 rows, 30,000 duplicates removed, 70,000 final, and a page that keeps responding during the build.

## Required tests
Testing Library tests for every criterion above, using an inline fake runner and fresh stores; clipboard button hidden without the API and working with a mocked API; stepper clamp table. Automated axe checks are out of scope (T17).

## PR notes
Expected size: about 450 non-test lines; report non-test and test counts separately (D-023). If non-test lines exceed 500, stop at the primitives-plus-shell boundary and note the split.
