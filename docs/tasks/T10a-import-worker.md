---
id: T10a
title: Offline CSV/XLSX worker parser and import API
status: in-review
depends_on: [T09]
branch: codex/T10-spreadsheet-import
---

# T10a — Import worker and selected-column API (planner-approved)

> Codex changes this card to `in-review` on its implementation PR. Reuse current `codex/T10-spreadsheet-import` branch, preserving all existing local edits/stash; **do not** reset or force-push merely to rename it. Base `00043497e5d5b95cf5334c4519c738459fde405e`. The original T10 card was already applied as the first branch change; replace its final content with the D-027 umbrella in this same PR. No documentation-only PR.

## Goal
Build a reusable, cancellable, **browser-only** `src/io/import/` module that reads local XLSX/CSV, parses in a dedicated Web Worker with **existing, pinned SheetJS 0.20.3**, exposes worksheet metadata, bounded previews and selected-column extraction, and never persists/uploads entrants.

## Scope and size
- Add `src/io/import/{protocol,import.worker,runner}.ts` (filename choices flexible), and colocated tests.
- Minimal task/HANDOFF status updates, D-027 decision, and preauthorized T10b card in **this T10a code PR**.
- **No UI**, changes to `InputScreen`, `useListBuilder`, `src/engine`, persistence schema, settings, export code, or new dependencies.
- D-023: aim ≤400 non-test changed lines, stop and propose an actual split if >500 (excluding tests/fixtures/lockfile).

## Required public API (typed; exact names flexible)
```ts
type ImportWorkbook = { sheets: Array<{ name: string; rowCount: number; columnCount: number }> };
type ImportPreview = {
  sheet: string;
  columns: Array<{ index: number; letter: string; header: string }>;
  firstRows: string[][]; // at most 5 data rows
  hasHeader: boolean; // caller-controlled interpretation; optional conservative suggestion
};
interface ImportRunner {
  open(file: File): Promise<ImportWorkbook>;
  preview(sheet: string, hasHeader: boolean): Promise<ImportPreview>;
  extract(sheet: string, columnIndex: number, hasHeader: boolean): Promise<string[]>;
  cancel(): void;
  dispose(): void;
}
```

Keep the parsed workbook **inside the worker** between `open`, `preview`, and `extract`; do not post the whole matrix to React. Messages carry request IDs; successful `extract` returns **exactly one candidate string per source row**, including blanks so later normalizer counts them. Use zero-based column indices; original worksheet order and row positions are stable. The runner owns the worker and rejects superseded requests with a recognizable cancellation error. After `cancel`/`dispose`, no stale response may succeed or write state. Creating a new file invalidates the old workbook.

## Parsing contract
- File bytes via `File.arrayBuffer()`; worker transfer where supported; parse in worker using Vite bundled `xlsx` only. No runtime CDN/script/network, external links, macros, HTML execution or formula calculation.
- XLSX: enumerate all sheets; sparse and merged cells remain blank, not filled down; `SheetJS` cached cell values may be used as inert text. Missing formula cache means blank. Never evaluate `cell.f`, formula strings, VBA or links. Number/date display values should be handled consistently and tested, including formatted identifiers with leading zeros when present.
- CSV: UTF-8 BOM, quoted delimiters, escaped quotes, embedded CRLF/newlines, Unicode and blank rows. Do not coerce CSV strings into formulas. Invalid/corrupt files return user-readable errors.
- Preview only bounded five data rows; header detection can provide a conservative suggestion, but UI can override. `extract` does not dedupe/normalize: it returns source cell texts so T10b can use the **existing** engine pipeline.
- No unbounded synchronous workbook scanning on the main thread, no persistent file bytes, preview, or roster. Worker is closed on cancel/dispose/error; no file bytes in browser storage or logs.

## Acceptance/tests
- Mock worker/runner protocol: valid open → sheet preview → extract, request IDs, concurrent requests and supersession, worker post failures, parse error, cancel and dispose, late/out-of-order messages, file read rejection.
- Real parser tests with fixture XLSX containing 2+ sheets, header/no-header, empty rows, merged/sparse cells, cached and uncached formula cells, Unicode, text/number/date and 50k-row column; CSV BOM, quotes, commas, newlines, malformed CSV and empty file. Assert row-to-cell positions and no formula execution.
- 50k-row workbook path is processed by the dedicated worker; no whole-workbook transfer to main. No runtime remote URLs introduced.
- `pnpm verify` and required CI green; PR reports non-test/test changed lines and documents the API with exact examples for T10b.

## Completion
No visible import UI in T10a; the API is stable for T10b. Do not add a demo screen or modify the draw flow just to exercise it. Await independent exact-SHA planner `APPROVE` and D-021 merge.
