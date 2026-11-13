---
id: T08
title: Draw flow, plain reveal, winner actions
status: stub
depends_on: [T07]
branch: codex/T08-draw-flow
---
# T08 Draw flow, plain reveal, winner actions

STUB. Codex must not start this card. Planner expands it (prompt P7) before dispatch.

## Intent
Draw button -> engine `draw` (pool via `eligiblePool`) -> DrawRecord saved -> plain (non-animated) winner screen with rank badges, Mark called / No-show / Undo, backup promotion visible, remove-called-from-pool behavior across rounds, one-at-a-time mode.
## Key acceptance
- Multi-round scenario test (round 2 excludes called and no-show).
- Winners announced via aria-live.
