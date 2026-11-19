---
id: T09
title: History view + exports
status: in-review
depends_on: [T08]
branch: codex/T09-history-export
---

# T09 — History and downloadable draw records (planner-activated)

> Activation: After T08 merged at `1a995ecdf74feece5eb27b059afa2a45d4aaf9a8`, the planner authorized this full replacement of the existing stub. Codex must start from updated `main` on `codex/T09-history-export`, apply this approved card **as the first change on the implementation branch**, then implement it in that same PR. Set status to `in-review` in the PR, not in a separate docs-sync PR.

## Goal
Allow users to revisit locally saved draws after a reload, inspect the complete record and event-derived winner/backup statuses, export the record to JSON/CSV/XLSX, delete one archived record, and clear stored history with confirmation. Keep history separate from the current in-memory entrant pool.

## Read
`AGENTS.md`; `docs/{PLAN,ARCHITECTURE,DECISIONS,HANDOFF}.md` (architecture sections 4–6, 10 and D-003, D-005, D-006, D-019–D-021, D-023); `src/{store/history.ts,store/session.ts,store/drawFlow.ts,engine/record.ts,engine/lifecycle.ts,db/repos.ts,ui/App.tsx,ui/screens/WinnersScreen.tsx}`; existing history/store/record tests.

## Planner decision for T09 (D-026)
History after reload is **read-only**: may inspect, export, and delete, but not CALLED, NO_SHOW, or UNDO. Archived records must never reenter `session.draws` or affect `eligiblePool` by matching recycled entrant IDs or hashes (D-020). Current-session winner actions remain in T08. Record this exact approved decision as D-026 in `docs/DECISIONS.md` within the T09 implementation PR, and update HANDOFF's planner P-1 note accordingly. This is planner-authorized content, not a Codex-authored policy change.

D-026 decision row (append unchanged):
`| D-026 | 2026-11-19 | T09 persisted-history browsing is read-only after reload: archived draws may be viewed, exported, or deleted, but their CALLED/NO_SHOW/UNDO actions are not editable through history. Never attach archived events to a new in-memory pool or use their entrant IDs/hashes for eligibility. Current-session actions remain in T08. | Avoids ambiguous cross-session action and entrant-ID semantics; preserves D-019/D-020 without expanding T09 into archive editing. |`

## Scope
- `src/ui/screens/HistoryScreen.tsx` (+ colocated tests): list/detail view and archive controls.
- `src/io/export/` small pure-ish browser export helpers and tests: JSON, CSV, XLSX, download via in-browser Blob/object URL. Reuse `toExportJson` and `toExportRows` from engine; do not change the schema, event semantics, or engine.
- Minimal `src/ui/App.tsx` navigation integration; minimal additive `src/store/drawFlow.ts` exposure of its existing injected history store if needed, without a new global state framework.
- `docs/tasks/T09-history-export.md` replacement/status; Codex-owned HANDOFF current-state update; planner-authorized D-026 and P-1 resolution in same PR.
- **SheetJS permitted here:** existing T09 stub explicitly authorizes lazy-loaded SheetJS for XLSX export before T10. Use the official SheetJS CDN-distributed npm tarball pinned to an exact **verified** version and a lockfile; never import via a runtime URL. Lazy import only on XLSX click. Document the exact dependency, its provenance, bundle effect, and any incompatibility with T10's future import work. No additional libraries.
- **D-023:** target ~400 non-test changed lines including planner-authorized documentation; **stop and propose a clean implementation split before exceeding 500**. Do not silently exceed the threshold or drop required export formats.

## History UI behavior
1. Add a keyboard-operable **History** control to the App shell. History is viewable after reload even though `session.draws` is empty; call `history.load()` when opening (or once on app start), with visible loading/empty/error and Retry states. Do not copy loaded records into the session.
2. List `history.records` in the repository's existing descending-`createdAt`, ID-tiebreak order. Each row shows date/time, entrant count, winner/backup count, winner names and status summary. Each row opens a detail view with full stable draw ID, full-list hash, normalization version, config, counts, ordered winner/backup slots with event-derived final statuses, exhaustion details and chronological event log. Render names only as React text. A live session draw may have events updated after the last load: reload from persisted records on History entry to show authoritative current statuses.
3. If any current-session draw has a slot not yet publicly revealed in one-at-a-time mode, do not expose History until the reveal is completed. Reuse the actual WinnersScreen visibility predicate: slots of rank ≤ `flow.visible[id]` are revealed, and **promoted/non-standby backups already displayed outside that prefix also count as revealed**. Do not use only `flow.visible[id] < draw.slots.length` as a blocker, because a promoted backup may already be visible and Next legitimately no longer advances the prefix: otherwise the archive UI would disclose names before T08's intended reveal. Do not put hidden names in any visible/accessibility DOM, list, detail, announcement or download button before full reveal. Use a clear message explaining why History is temporarily unavailable. If needed, block entering History while `flow.busy`.
4. Archived history detail is read-only: **no** mark-called, no-show or undo buttons on old records; show a subtle 'Archived record — read only' label. Current-session actions remain only in WinnersScreen.
5. Deletion: explicit confirmation before deleting one record or **Clear all history**. While `flow.busy`, disable history mutations. Never delete a persisted record whose ID is still referenced by `session.draws`; never Clear all history while any in-session draws exist, even if resolved. Explain that the current session must be cleared (after resolving active winners) before deleting those records. This prevents orphaned or diverging in-memory draw state. Deleting archived records must not reset or alter the active entrant list, settings, or current session generation.
6. Use `history.remove` and `history.clear`, with actionable failures/retry and confirmation cancellation leaving records intact. Avoid direct IndexedDB access from UI. 'Clear all history' means **draw records only**, not the raw list (already ephemeral) or the local settings whitelist. A broader 'Clear all app data' may be a separate later user-facing action; do not misleadingly label this one 'Clear all data'.

## Export contracts
1. Export exactly the selected **persisted** record, with its full existing event log and derived statuses, regardless of current input pool. Filenames are safe `draw-<validated-id>.<ext>`; sanitize non-alphanumeric filename characters and prevent path traversal.
2. JSON: use `toExportJson(record)` unchanged, UTF-8 `.json` MIME; schema v1 includes counts, list hash, config, slots, events and final status.
3. CSV: a **single valid RFC-4180 UTF-8 CSV** containing all three existing `toExportRows(record)` sections, with a leading `section` column (`summary`, `slot`, `event`) and a stable union of column headers. Escape embedded quotes, commas and newlines; use CRLF record separators; optional UTF-8 BOM for Excel. Keep all fields strings. Reuse `toExportRows` formula-safe cells (leading `= + - @\t\r` prefixed with apostrophe); do not sanitize raw names ad hoc or drop log fields.
4. XLSX: three separate sheets named `Summary`, `Slots`, `Events`, sourced from those same sanitized `toExportRows`. Cell values must be strings, **never formulas**; verify values starting with formula triggers remain inert and do not produce formula cells. Download `.xlsx` from a lazy-loaded, locally bundled SheetJS module; no runtime fetch/CDN.
5. Blob downloads must release object URLs, avoid accumulating huge objects, and not persist any new data in localStorage/sessionStorage/IndexedDB. Generate only for user clicks, never automatically on mounting history. Errors should be visible and retryable.

## Required tests
- Real fake-indexeddb setup: save 2+ records, reload into a **fresh** session, show sorted list/detail with final statuses (CALLED / NO_SHOW / PROMOTED / EXHAUSTED / UNDONE), no cross-session eligibility or raw-name storage.
- UI: opening History/loading/empty/error/Retry, keyboard navigation and accessible names, winner details and events, no raw HTML/name injection, no unexpected network calls.
- Reveal privacy: one-at-a-time in-session draw cannot expose unrevealed names in History, accessibility tree or exports until reveal complete.
- Delete one/clear all: confirm/cancel, success and failure paths; block if active in-session draws referenced; deleting unrelated archived draw does **not** change `session.draws`, generation or eligibility. Verify history remains deleted after reload.
- JSON snapshot equals `toExportJson`; CSV parse/round-trip and Excel-oriented quoting for quotes, commas, CRLF and formula-like names; XLSX round-trip with SheetJS and `cell.f === undefined` for every generated cell, and three correct sheet names; event log and counts agree in all three formats.
- Download blob MIME, filename sanitization, object URL cleanup, failure/error feedback and zero storage writes caused by exports. Confirm SheetJS is lazy in build output and no runtime network source added.
- `pnpm verify` locally and required GitHub CI. PR reports non-test/test changed line counts separately; explicit scope and remaining limitations.

## Out of scope
Archived winner-status editing, import, all-draw bulk export, server/API/network upload, new persistence schema, editing the engine RNG/lifecycle, animations, PWA, analytics, unrelated refactors.

## Review focus
D-020 pool isolation, accidental disclosure of unrevealed names, event-log completeness and CSV/XLSX formula safety, deletion of in-session records, download cleanup, no network, exact dependency provenance, and successful user workflows.
