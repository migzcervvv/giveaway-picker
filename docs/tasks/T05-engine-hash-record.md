---
id: T05
title: Engine: hash, record
status: in-review
depends_on: [T04]
branch: codex/T05-engine-hash-record
---
# T05 Engine: hash, record

## Goal
Verifiable entrant-list hash and the draw record object used by history and exports.

## Read first
ARCHITECTURE sections 4 (DrawRecord), 6; DECISIONS D-003.

## Scope
- `src/engine/hash.ts`: `hashEntrants(entrants): Promise<string>`.
- `src/engine/record.ts`: `buildDrawRecord(input): Promise<DrawRecord>`, `toExportJson(record): string`, `toExportRows(record): { slots: Row[]; events: Row[]; summary: Row[] }` (plain row objects for CSV/xlsx writers; no file I/O here).
- Types `DrawRecord`, `ExportSchemaVersion`.
- Colocated tests; exports from `index.ts`.

## Out of scope
Dexie, file download, SheetJS, UI.

## Spec
- Hash input: `String(NORMALIZATION_VERSION) + "\n" + keys.sort((a,b)=> a<b?-1:a>b?1:0).join("\n")`, UTF-8, SHA-256, lowercase hex, via `crypto.subtle.digest`.
- Hash is independent of entrant order and of display casing.
- `buildDrawRecord` takes `{ id, createdAt, buildStats, entrants, config, result, events }` and stores no entrant list, only counts and `listHash`. `entrants` is used solely to compute the hash.
- `toExportJson`: stable key order, 2-space indent, `schema: 1`, `hashAlgo: "sha256"`.
- `toExportRows`: CSV-safe strings; any cell starting with `=`, `+`, `-`, `@`, tab, or CR is prefixed with `'`.
- `finalStatus` per slot derived via `deriveState`.

## Acceptance criteria
- [ ] Known-answer test: hash of `["alice","bob"]` computed independently (state the expected hex in the test and how it was derived).
- [ ] Order independence and case independence tests.
- [ ] Record contains no field holding the full entrant list (test walks the object).
- [ ] Formula-injection test on rows.
- [ ] JSON snapshot test for a fixed record.

## Required tests
As above.

## PR notes
Check that nothing here can leak raw entrant names.
