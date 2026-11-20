---
id: UX06
status: ready
depends_on: [UX05]
---

# UX06 — Shuffle roster and configure batches (depends on UX05)

- Add **Shuffle Names** beside entrant controls, available when a roster has been built and no unresolved draw blocks edits. **Actual source roster order changes** in the editable list, not merely a cosmetic animation. No chosen winner is changed. Use existing `cryptoSource` / `partialShuffle` (full-length Fisher–Yates), **never Math.random**. Preserve every logical entry, duplicates/blank handling, unicode, imported names containing commas such as `Doe, Jane`, counts, dedupe/fold options and accurate list hash. Keep current draw results immutable and disable shuffle until active round is resolved/cancelled. Handle 50,000 imported names without blocking the UI; use existing build runner as necessary. Make the action visibly confirm it completed (without showing secret winners) and avoid confusing rapid repeat calls.
- **Batch size** is a **memory-only presentation preference**. Defaults stay Minor=6, Major=3, Grand=1; allow preset 1, 3, 6 and custom 1–10, with a clearly readable control (no new business rules). One-at-a-time mode overrides batch size with an explanation; existing winners/backups counts remain separate. Changing batch size between batches must never skip, repeat/accidentally reveal, or change any selected result; use **disclosed count as the only cursor** (`nextCount=min(disclosed+batchSize, slotCount)`, not floor-to-multiple) and make paging usable with previously disclosed groups. No unreadable 10-card stage wall or offscreen winner names: paginate/bound visible card count for mobile and projector.
- Tests: 7/30 winners, switch 6→3→1, customize 10, one-at-a-time, no unauthorized disclosure (including AX/ARIA), `Doe, Jane` import, duplicates/diacritics/RTL, repeated shuffles, 50k roster, stable SHA, unchanged winner selection fairness, no network. Keep select buttons keyboard-operable; no unnecessary state persistence.
