---
id: T10
title: xlsx/csv import + column picker
status: stub
depends_on: [T07]
branch: codex/T10-spreadsheet-import
---
# T10 xlsx/csv import + column picker

STUB. Codex must not start this card. Planner expands it (prompt P7) before dispatch.

## Intent
Install SheetJS from the CDN tarball at an exact version. Worker parses file; sheet selector; header detection; column picker with first-rows preview; select column -> names flow into the same engine path as paste. Formulas never evaluated; cached values only. Lazy-loaded chunk.
## Key acceptance
- 50k-row xlsx imports without freezing UI; csv with quoted commas and BOM handled; merged cells and empty rows handled.
- Works fully offline.
