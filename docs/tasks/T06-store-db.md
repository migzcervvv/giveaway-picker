---
id: T06
title: Store + Dexie history
status: stub
depends_on: [T05]
branch: codex/T06-store-db
---
# T06 Store + Dexie history

STUB. Codex must not start this card. Planner expands it (prompt P7) before dispatch.

## Intent
Zustand `session`, `settings`, `history` stores; Dexie `draws` table; repo functions to save a DrawRecord, append events, list, delete one, clear all. Entrant names never written (D-003).
## Key acceptance
- Reload keeps history and settings; reload loses the entrant list by design.
- fake-indexeddb tests for repos; store tests for session transitions.
- beforeunload warning while an open draw has unresolved slots.
