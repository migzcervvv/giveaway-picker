---
id: UX03
title: The Lucky Draw — shuffle, card flip and event-ready verification
status: done
depends_on: [UX02]
branch: codex/UX03-card-reveal
---

# UX03 — Stage 2: Entertaining reveal and event-ready acceptance

> Preapproved under D-028, **hard-gated on UX02 merge**. Work on a new branch from merged main. Mark in-review in same implementation PR, update HANDOFF. No extra activation or separate docs PR.

## Goal
Add **one** restrained reveal effect to the functioning Audience View, then verify complete end-to-end event operation. Make anticipation fun while keeping the raffle fast.

## Scope
- Prefer lightweight CSS transitions/keyframes + React local state; small `src/reveal/` cosmetic helper only if needed. No Matter.js, 3D drum physics, reel, wheel, complex timeline engine or extra dependency unless separately authorized.
- On explicit Reveal click: **2–3 second** shuffled mystery cards/ticket numbers, then quick card-flip display of the **already selected and persisted** winner names. Minor: batches of up to six, reveal together for speed. Major: smaller groups (2–3) with a slightly longer pause. Grand: one larger card and a modest pause. Keep durations bounded; permit immediate Skip / Reveal now, never force dozens of sequential 10s animations.
- Short, subtle celebratory accent (e.g. capped decorative CSS confetti for <1s); no clutter during the long hold for winners to walk onstage. Optional short tick/chime using WebAudio only after a user gesture; accessible Mute, graceful if audio unsupported. Avoid external assets and runtime network.
- `prefers-reduced-motion` should show names **immediately on explicit Reveal**, not show spinning/flip/confetti; keep the same underlying visibility and accessibility semantics. No audio autoplay.
- Strictly cosmetic: animation never invokes RNG to choose/alter winning slots; keep result saved before any celebration and do not expose winner name in DOM while card is face-down. Multi-click, skip, slow device, unmount, return to operator, and new draw must clean up timers/audio/listeners without stale reveals or mistaken announcements.
- Preserve ability to mark winner called/no-show, promote backup and return to stage; show readable current results without replaying a previously completed reveal by accident. Do not alter D-019/D-020/D-026.

## Event-ready verification gate
- Exercise real, production-build browser scenario: paste or CSV/XLSX import; set winners+backups; Audience View; start, persist, shuffle, reveal six minor winners; mark called/no-show, promotion; second round; major and grand pacing; History; all three exports; reload and archive; keyboard, mute, skip, reduced motion, 390/768/1440/1920px; long/RTL/emoji names.
- No externally initiated network requests, unexpected persisted roster data, console errors, page errors, hidden-name DOM leaks, clipped projector layout or uncaught timer transitions. Manual screenshot/short screen capture evidence and precise limitations.
- Test reveal order, never-render-before-reveal, timer cleanup/skip/double clicks, all-at-once/one-at-a-time, batch pagination, sound-muted/reduced motion and persistence-before-animation. `pnpm verify` + required CI green.
- D-023 target ~400 non-test changed lines, stop and request a real clean split before >500; retain all acceptance criteria if split. SHA-bound PR review and merge under D-021.

## Definition
**Both user-approved design stages are complete** after UX01, UX02, UX03 are reviewed, merged and this event-ready browser gate passes. This does **not** complete the original full-v1 PLAN.md definition (T11–T17 remain pending/stub for later reconsideration). Do not mark them done or silently claim PWA or multiple animation modes shipped.
