# DECISIONS.md (planner-owned, append-only)

Format: ID, date, decision, reason. Superseding a decision = new entry that references the old ID. Decisions made only in chat do not exist until written here.

| ID | Date | Decision | Reason |
|---|---|---|---|
| D-001 | 2026-11-13 | Outcome is computed by `src/engine` before animation. Animation is a cosmetic replay. | Fairness and auditability. Physics-derived results are not verifiable. |
| D-002 | 2026-11-13 | Dedupe on by default, toggle to disable. Key = normalized name. First occurrence kept. | Distinct people sharing a name collapse; owner can opt out. |
| D-003 | 2026-11-13 | Raw entrant names are not persisted. Store winners, backups, counts, SHA-256 of normalized list. | Privacy. Hash gives verifiability without keeping the list. |
| D-004 | 2026-11-13 | Default reveal: raffle drum. Reel and wheel selectable. | Strongest lot-drawing feel. |
| D-005 | 2026-11-13 | Record exports v1: JSON, CSV, xlsx. PDF deferred. | Scope. |
| D-006 | 2026-11-13 | Next-draw pool excludes: called (if `removeCalled`), no-show (always), pending/standby of earlier open draws (always). | Prevents double-winning and re-drawing unresolved slots. |
| D-007 | 2026-11-13 | Google Sheets import deferred to v2: Google Picker with `drive.file`. Not `spreadsheets.readonly` or `drive.readonly`. | Offline-first v1; avoids Google app verification. |
| D-008 | 2026-11-13 | Dark editorial theme, tokens in ARCHITECTURE section 8. | Matches MIGGZ brand. |
| D-009 | 2026-11-13 | Fonts self-hosted via `@fontsource`. No CDN fonts or scripts. | Offline and privacy. |
| D-010 | 2026-11-13 | Toolchain: pnpm, Vite, React, TypeScript strict, Vitest, Playwright. Exact versions pinned at T01 and recorded in HANDOFF. | Reproducibility. |
| D-011 | 2026-11-13 | Repo scripts are Node `.mjs`, not bash. | Windows-safe. |
| D-012 | 2026-11-13 | All randomness, including cosmetic, flows through `src/engine/rng.ts`. `Math.random` banned in `src/`. | Single auditable RNG surface. |
| D-013 | 2026-11-13 | PRs are squash-merged by the owner after planner verdict. Codex never merges. Branch protection requires PR + green `verify` check, 0 required approvals (solo owner). | Review is out-of-band by planner; GitHub cannot require a self-approval. |
| D-014 | 2026-11-13 | TypeScript pinned to 6.0.3 until typescript-eslint supports TypeScript 7. Revisit via a task card. | T01 finding: typescript-eslint compatibility. |
| D-015 | 2026-11-13 | "No network URLs in built output" means: no external resource references in built HTML/CSS, no runtime network requests (verified by Playwright in T16/T17), and a post-build dist check script asserting the CSP meta is present and no external URLs appear in dist HTML/CSS (specified in the T16 card). Inert URL strings inside bundled dependencies (React error-help links, XML namespaces, license comments) are allowed. | A literal grep fails on dependency strings without adding privacy value. |
| D-016 | 2026-11-13 | T01 version pins accepted: Node 26.13.1 (`.nvmrc`), pnpm 12.18.0, GitHub Action majors checkout v7, pnpm/action-setup v6, setup-node v7. Chosen by Codex; CI green with them; not independently verified by the planner. Bumps go through a task PR. | Reproducibility; states the verification level. |
| D-017 | 2026-11-13 | Hosting target and Vite `base` are decided before T16 is dispatched. | Default `base` of `/` breaks GitHub Pages project sites. |
| D-018 | 2026-11-13 | Clarifies D-006: a draw is open while any slot is `pending` or `promoted`. Once no active slot remains, unused `standby` backups are released into the eligible pool. Called and no-show exclusions continue to follow D-006. No separate CLOSE event is added. | Makes pool release predictable without introducing new lifecycle events. |
| D-019 | 2026-11-13 | Once a later draw has been created, undo is disabled for all earlier draws. Undo is allowed only for the most recently created draw in the current in-memory session. This is enforced by the store/orchestration layer, not the pure single-draw `applyAction` engine. | Prevents a closed earlier draw from reserving an entrant who has already entered a later draw. |
| D-020 | 2026-11-13 | T02 entrant IDs (for example `e1`) are scoped to the current in-memory entrant pool. D-006 exclusion uses only draw events associated with that exact pool; never apply persisted history events to a newly built list solely by matching entrant IDs or an order-independent list hash. Changing the input pool clears the in-memory draw association; persisted history remains. | After reload or input reordering, IDs can be reused for different people. Cross-session ID matching could exclude or redraw the wrong entrant. |
| D-021 | 2026-11-13 | Supersedes the merge-actor restriction in D-013: Codex may squash-merge a PR only after an explicit planner `APPROVE` verdict for its exact head SHA, required `verify` CI is green, and the owner has delegated merge execution. Codex must verify these conditions immediately before merging, preserve local uncommitted edits, fast-forward-sync `main`, and report the merge SHA. It may never merge a changed, unreviewed, blocked, or changes-requested PR. The owner retains control and may revoke delegation. | Removes repetitive owner CLI work without removing independent review, branch protection, or final owner authority. |
