---
id: UX04
title: Manage revealed winners between audience batches
status: in-review
depends_on: [UX03]
branch: codex/UX04-manage-revealed
---

# UX04

Source: [issue #27](https://github.com/migzcervvv/giveaway-picker/issues/27). See architecture sections 4, 5 and 10 and decisions D-021, D-023, D-026 and D-029.

- Return to operator during an incomplete reveal opens Manage revealed winners in the same tab. Show only disclosed slots for the active draw. Allow Called, No-show and safe scoped Undo.
- Keep future winners, standby backups and undisclosed promoted backup identities out of the DOM, accessible tree, announcements and controls. Exclude History, roster and other draws.
- Persist lifecycle actions normally. Resume at the existing disclosure position and explicitly reveal subsequent saved slots in order.
- Protect against busy writes, double input, stale callbacks, generation changes and unmount.
- Verify 7- and 30-winner draws through the real App and production browser, including promotion in history, repeated rounds, keyboard, reduced motion and external requests.
- No engine, backend, dependency or animation changes. Run pnpm verify and request independent review of the exact head.
