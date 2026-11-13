---
id: T07
title: App shell, theme, input UI
status: stub
depends_on: [T06a, T06b]
branch: codex/T07-input-ui
---
# T07 App shell, theme, input UI

STUB. Codex must not start this card. Planner expands it (prompt P7) only after both T06a and T06b merge (D-022).

## Intent
Editorial dark shell; paste box with large-input handling (worker normalize + dedupe above 5k lines); live summary (rows, blanks, duplicates removed with expandable list, final count); config panel (winners N, backups M with clamping, dedupe/fold/removeCalled toggles); tabular-paste hint.
## Key acceptance
- 100k-line paste keeps UI responsive.
- Keyboard-only flow works; labels and focus states present.
