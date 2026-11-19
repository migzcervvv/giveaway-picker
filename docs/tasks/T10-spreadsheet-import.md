---
id: T10
title: XLSX/CSV import + sheet and column picker
status: ready
depends_on: [T09]
branch: codex/T10-spreadsheet-import
---

# T10 — Offline spreadsheet import (planner-activated)

> **Activation:** Planner authorized after the T09 PR #21 review; start **only after PR #21 is merged**. On `codex/T10-spreadsheet-import` from the merged `main`, replace the prior T10 stub with this full card **as the first change**, and set status `in-review` in the same implementation PR. No docs-only PR.

## Goal
Import a local CSV or XLSX file entirely in-browser, allow the user to select worksheet (XLSX), inspect candidate columns and first rows, choose the name column and whether the first row is a header, then apply the selected names to the **same session list-building path as paste**. No upload, network request, or raw-name persistence.

## Read
`AGENTS.md`, `docs/ARCHITECTURE.md` §§3–4, 9–10, `docs/DECISIONS.md` D-002, D-003, D-006, D-012, D-020–D-026; `docs/tasks/T07a-build-runner.md`, `docs/tasks/T07b-input-ui.md`, `docs/tasks/T09-history-export.md`; `src/io/build/{runner,protocol,build.worker}.ts`, `src/ui/{screens/InputScreen.tsx,hooks/useListBuilder.ts}`, `src/engine/{paste,normalize,dedupe}.ts`, session/settings/drawFlow stores. Do not duplicate engine normalization.

## Scope
- `src/io/import/`: typed worker message protocol, locally bundled/lazy SheetJS parse worker, small runner with cancellation/stale-result protection; focused tests. Reuse the existing pinned SheetJS **0.20.3** from T09; no second spreadsheet library or new dependency.
- `src/ui/screens/InputScreen.tsx` and at most one focused `src/ui/components/` file: file input, worksheet selector, header-row switch, column selector, bounded 5-row preview, explicit **Use selected column** action, progress/errors/cancel; UI and integration tests. Use native accessible controls and existing theme/components.
- Minimal `useListBuilder` extension **only if necessary** to import an exact list of selected cells without the `splitPaste` single-line delimiter heuristic corrupting a name such as `Doe, Jane`. Do not refactor it wholesale.
- Task card and HANDOFF Codex-owned current state/status in the **same PR**.
- No exporter refactor, new settings keys, raw-roster persistence, history mutation, draw engine changes, animation or PWA.
- D-023: target ~400 non-test changed lines, **stop and request a clean split before >500**; do not silently exceed to cram parser and UI into one PR. Tests excluded.

## Parsing and UI contract
1. Accept `.xlsx` and `.csv` via a native file input. Read file bytes using browser file APIs; send the `ArrayBuffer` to a dedicated Web Worker with transferable ownership when supported. Parse **in the worker** using lazy, locally bundled `xlsx`. No CDN imports, no runtime network, no server/API calls, no file bytes or previews saved to localStorage/IndexedDB. Revoke/dispose workers and drop file bytes after application/cancel.
2. CSV must handle UTF-8 BOM, quoted commas/quotes/newlines and CRLF. For XLSX, list worksheets in workbook order; allow changing sheets. Preserve sparse/merged cells as blanks (never propagate merged labels into unrelated records). Handle blank rows, header/no-header, non-ASCII names and long files.
3. Show sheet name (CSV has one logical sheet), row count where practical, bounded preview (first five **data** rows and optional header), each column identified by header text when present plus A/B/C index; allow choosing any column, not only the first. Auto-detect a plausible header conservatively (prefer 'Name', 'Full Name', etc.) but make it overridable; never guess a column silently for final import.
4. Treat parsed **cell values as inert data**. Do not evaluate formulas, external links, macros or HTML. Use only cached values for formula cells; if a formula lacks a cached value, show blank. Never call `eval`, `innerHTML`, or execute spreadsheet code. Use SheetJS options and tests to verify that `=1+1`, `+cmd`, and malicious HTML remain strings, never execute. Do not allow a cell value to introduce an extra entrant through embedded newlines; normalize embedded whitespace for name display using existing name-normalization policy.
5. Only **Use selected column** commits to the active session. Previewing/choosing files/sheets/header/column must not change `session.rawText`, session generation, eligible pool, or history. Importing a new list follows the existing unresolved-draw lock: block importing/applying if any pending/promoted slot; do not partially reset the pool. Recheck lock and component liveness **when the async file read/worker finishes and again when applying**. Warn clearly that applying replaces the current pasted entrant list.
6. Applying an imported column must go through the same dedupe/diacritics build pipeline as paste, with accurate blank/duplicate/final counts, and prevent Draw while processing. Preserve **one selected cell = one original candidate row** (including names containing commas/tabs, even for a single selected row); never incorrectly split a single imported name by `splitPaste` comma/semicolon heuristics. If data has no usable names, report it without destroying the previous list. Keep names in memory only.
7. A new file selection supersedes and cancels an earlier parse; navigation away/closing import invalidates outstanding responses. File read/worker errors show a retryable message, without writing stale or half-parsed data to the session. No unbounded preview DOM or full-sheet React rendering; 50k rows must not freeze the main thread. Graceful error for invalid/corrupt/unsupported files; no automatic CSV formula interpretation.
8. Accessible labels and focus/keyboard flows for file, sheet, header, column, preview and Apply/Cancel. Respect reduced motion. Clear any retained file bytes, worker state, and preview on cancel/unmount; don't automatically reimport on remount.

## Required tests
- 50k-row XLSX (worker path) with UI responsiveness and correct row/selection counts; confirm SheetJS is lazy and entirely local in production browser.
- XLSX two sheets, header/no-header override, sparse/merged cells, empty and Unicode rows, Excel text/number/date cached values, formula cells with and without caches never evaluated.
- RFC-style CSV BOM, escaped quotes, quoted commas/newlines, malformed CSV error behavior, names such as `Doe, Jane` (single-row and multi-row) preserved as single entrants.
- Preview-only operations do not alter session; apply commits selected column exactly once and triggers existing normalization; duplicate/blank counts agree; Draw disabled until current build; clear user feedback for replacing an existing pool.
- Lock with unresolved draw blocks import and preserves current session; worker results are ignored after new file selection, canceled navigation, or pool-generation change. Failures leave current list usable; no race can invalidate an in-flight draw.
- Browser: 390/768/1440px, keyboard-only, reduced motion, no console errors or runtime network. `pnpm verify` and required CI green; PR reports non-test/test changed-line counts.

## Out of scope
Google Sheets / OAuth, external URLs, live spreadsheet connections, drag-drop enhancement, importing multiple name columns simultaneously, formulas/macros evaluation, workbook exports (T09 already owns them), animation, history, bulk data storage.

## Review focus
No-roster persistence/network; worker parsing and cancellation; accurate one-cell-to-one-name mapping; session generation/locks; cross-sheet/header/column selection; 50k responsiveness and memory; accessibility; no spreadsheet code execution.
