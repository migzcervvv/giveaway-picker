---
id: T10b
title: Spreadsheet picker UI and entrant-list integration
status: in-review
depends_on: [T10a]
branch: codex/T10b-import-ui
---

# T10b — Spreadsheet picker UI and session integration (planner-preapproved)

> **Hard gate:** Although this card is fully planner-approved now (D-027), **do not start any implementation until T10a is approved and merged into `main` under D-021**. Branch from that merged `main` at that time, then mark this card `in-review` in the implementation PR. No new planner activation or docs-only PR is required.

## Goal
Add an accessible local-file Import flow above the T10a API: choose XLSX/CSV, choose sheet, override header assumption, see bounded preview and select the exact name column, then explicitly apply it through the existing list-normalization flow.

## Scope and size
- `src/ui/screens/InputScreen.tsx`, optionally one focused `src/ui/components/ImportPicker.tsx`, minimal `src/ui/hooks/useListBuilder.ts` and **only if required** session memory interface to preserve exact imported rows, with colocated tests. Use the T10a runner without modifying its contract or adding libraries.
- Task status and HANDOFF Codex sections in **same PR**; no new settings keys, engine parser rewrite, record export changes or backend.
- D-023 target ≤400 non-test lines, stop/split before exceeding 500.

## UI contract
1. Native file input accepts `.csv,.xlsx`; label it. Show progress/read/cancel/error/retry states without a blocking synchronous parse. Never touch session merely by choosing a file, changing sheets/column/header, viewing preview, or canceling.
2. XLSX worksheet selector in workbook order; CSV presents a single logical sheet. Header toggle (with safe suggestion only), explicit column selector (A/B/… plus header), preview up to five **data rows** as text; correct blanks, spaces and escaping, no `innerHTML`.
3. `Use selected column` is explicit. Warn when replacing existing list. Reject zero usable names without modifying the previous pool. Lock import/apply while `hasUnresolvedDraw(session.draws)` and recheck lock, generation, component liveness and file request identity after every async boundary and on Apply. No delayed worker result may overwrite newer pasted/typed text.
4. **One selected cell = exactly one candidate row**, including `Doe, Jane`, semicolon/tab names, and a single selected row. Embedded cell newlines become normalized whitespace **within** a name, never a second entrant. Feed exact candidate rows through the existing `buildEntrants` normalization/dedupe worker; do **not** simply call `splitPaste(singleName)` (comma delimiter bug). Preserve correct blank/duplicate/raw/final counts and stable imported draft across navigation/rebuild, without storing roster. If necessary, add the smallest **memory-only** session distinction between pasted text and imported rows, with explicit tests; do not change the engine normalization algorithm.
5. Disable Draw until the imported build completes/current generation matches. Applying names invalidates earlier resolved pool in the same way as paste, and cannot reset unresolved draws.
6. Keyboard-focusable file/sheet/header/column/Apply/Cancel, accessible errors and busy states, responsive mobile/desktop, reduced-motion safe, no runtime remote requests or persistence.

## Required tests
- Real App integration: choosing/previewing/canceling never mutates session; applying correct column updates input, build stats and selected names; Draw blocked during build and possible after success.
- Single-row `Doe, Jane`, comma/semicolon/tab cell text, embedded newlines, blank rows, duplicates, no-header CSV and multi-sheet XLSX. Assert one-cell/one-entrant and accurate `rawCount`/`blankDropped`/`duplicatesRemoved`/`finalCount`.
- Unresolved draw lock, generation change, stale worker callbacks after cancel/unmount/new file, applied import followed by navigation away/back; no lost draft or stale draw; existing paste/clipboard behavior remains intact.
- Production browser: 50k-row XLSX responsiveness, 390/768/1440 width, keyboard, reduced motion, offline network checks, all file types and invalid-file error.
- `pnpm verify`, required CI and exact-head PR review. No merge without planner APPROVE under D-021.

## Out of scope
Google Sheets, multiple simultaneous name columns, bulk roster persistence, animation, history redesign, spreadsheet export changes, drag-and-drop refinements.
