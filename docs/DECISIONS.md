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
