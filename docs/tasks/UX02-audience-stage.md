---
id: UX02
title: The Lucky Draw — audience stage and static reveal
status: in-review
depends_on: [UX01]
branch: codex/UX02-audience-stage
---

# UX02 — Stage 1B: Audience presentation (static and reliable)

> Preapproved under D-028; **hard-gated on UX01 merge**. Branch from merged main; mark in-review in same implementation PR, with HANDOFF update. No extra activation or docs-only PR.

## Goal
One browser-tab, projector-friendly **Audience View** distinct from Operator View. Audience View is uncluttered: dark navy stage, subtle gold labels, big readable winner cards. Make a complete static workflow *before* animations.

## Scope
- Minimal additions to `src/ui/App.tsx` and `src/ui/screens/` (e.g. `AudienceStage.tsx`), theme styles, essential tests. Reuse `drawFlow` and event-derived slots; don't duplicate draw logic or modify pure engine/database schema.
- **Single tab only**, no popup/BroadcastChannel/sync service for now. Operator configures before entering Audience View; the stage provides a clear Start Draw (if ready), Reveal, Next batch / Return to operator control appropriate for the current result. Fullscreen optional via user gesture; no automatic fullscreen requirement.
- Stage starts as "Ready" with a simple prize-category display preference (Minor / Major / Grand) **memory-only**; this affects visual labels/pacing later, never entrant eligibility or persisted draw records. Don't introduce prize-tier DB fields.
- **Draw must finish persisting before any name is publicly revealed.** Until deliberate Reveal, no selected winner names in the audience DOM, accessible tree, `aria-live`, headers or buttons. Avoid leaking `drawFlow.announcement` on stage. Do not use CSS opacity to conceal already-rendered names. Never render raw entrant roster or historical/administrative data on stage.
- Distinguish selected vs publicly shown; implement the smallest gate necessary so navigation / History cannot unexpectedly disclose a not-yet-presented result in a projected workflow. A safe return-to-operator action must be explicit; test switching before and after reveal. Preserve existing T08 `oneAtATime` / promoted-backup display and T09 privacy/history gate; no future name previews.
- Static Reveal displays current draw's **preselected** winners as large legible cards (minor could show six or paginate, major smaller batches, grand prominent single card). No animation yet. Resolve multi-winner overflow with bounded paging/layout; handle 60+ character/RTL/emoji names.
- Operator retains Mark Called, No-show, Undo and backup actions. Stage must reflect current statuses, without presenting standby backups as additional winners.

## Acceptance
- Workflow: configure in Operator -> enter Audience -> draw and persist -> ready stage -> explicit Reveal -> all current winners visible -> return Operator -> call/no-show/promotion -> stage reflects final statuses; repeat round.
- Invariant: animation/UI never chooses, reorders or excludes entrants. No selected name in audience DOM *before* reveal, including live regions and alert text. History/alternate navigation must not bypass the stage's not-yet-revealed gate. Page reload/re-entry behaves safely.
- Works 390/768/1440/1920px, no clipping on projector or long names; keyboard and reduced motion; stage buttons obvious, minimal, nontechnical; errors handled, double-start blocked.
- Real browser walkthrough and focused UI tests for name privacy, persisted-before-show, multiple winners, no-show/promotion, stage exit, keyboard and existing T08/T09 regressions. `pnpm verify`, required CI; D-023 ~400 target / stop >500. SHA-bound approval/merge.
