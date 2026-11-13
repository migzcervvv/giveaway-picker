---
id: T16
title: PWA offline
status: stub
depends_on: [T12]
branch: codex/T16-pwa
---
# T16 PWA offline

STUB. Codex must not start this card. Planner expands it (prompt P7) before dispatch.

## Intent
vite-plugin-pwa: precache all assets, installable, update prompt, offline-first. No runtime caching of cross-origin.
## Key acceptance
- Playwright: load once, go offline, reload, full draw works.
- Playwright asserts zero network requests at runtime.
