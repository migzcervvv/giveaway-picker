---
id: T06
title: Store + Dexie history (split umbrella; do not implement)
status: stub
depends_on: [T05]
branch: codex/T06-store-db
split_into: [T06a, T06b]
---
# T06 Store + Dexie history — historical umbrella

**Do not dispatch or implement this card.** Decision D-022 splits its implementation into two sequential, independently reviewable PRs. The previous combined T06 specification is preserved in repository history (the PR #7 merge). The requirements are redistributed without dropping acceptance criteria:

- **T06a — IndexedDB history:** `docs/tasks/T06a-db-history.md` (`status: ready`, depends on T05). Owns Dexie schema, CRUD, strict privacy projection, DRAWN validation, and atomic event append; installs pinned Dexie and test-only `fake-indexeddb`.
- **T06b — Session, settings, history store, unload guard:** `docs/tasks/T06b-store-session.md` (`status: stub`, depends on T06a). Owns Zustand, memory-only pool association, D-019/D-020 guards, settings whitelist, persistence-backed history store, and the `beforeunload` warning.

T07 explicitly depends on both. The planner changes T06b to `ready` only after T06a is approved and merged. Do not open a PR on branch `codex/T06-store-db`.
