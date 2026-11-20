---
id: UX07
status: ready
depends_on: [UX06]
---

# UX07 — Standby, replay and pause + final UX (depends on UX06)

- Add a **Standby / Hide Audience** button for emergencies, host intermissions and transitions. It must **unmount** winner/roster/technical content from projected DOM/AX while active, displaying only a neutral message. Resume to the same saved draw, already-disclosed count, page and status, never regenerate or leak unseen names. No new popup, external display sync or multi-tab mechanism; mirrored desktop privacy still depends on venue routing.
- Add **Replay Reveal** for the most recently disclosed page using the **same saved winners**, with no new draw, persistence, eligibility change, new disclosures or confusing "winner selected" notifications. Disable while draw is pending; avoid displaying undisclosed names. Clear visual labeling that it is a replay.
- Add **Pause / Resume** only for an in-flight decorative shuffle/timeline (not the saved draw). Freeze and resume remaining animation time safely; Skip and reduced-motion overrides still work. Avoid unnecessary pause UI when nothing is moving. Preserve timers/media query/audio cleanup on unmount, cancel, reset, re-entry and new draw. Sound remains user-gesture-only and muting remains reliable.
- Make all controls cohesive but restrained; ergonomic 44px targets, keyboard focus, responsive 390/768/1440/1920 and projector readable. If mirrored projector would display sensitive controls, give an explicit warning; do not pretend CSS standby creates a private second display.
- Full event Chrome acceptance: import CSV/XLSX → shuffle → adjust counts → Minor 30 winners → 6-person reveal → manage called/no-show/promotion → pause/skip/standby/replay/continue → restart remaining round → new round → reset keep roster → reset clear roster → History + exports → reload; short/long/RTL/emoji names; reduced motion; 0 external requests and no page errors. Log known local favicon 404s without escalating.
- Preserve UX01–UX04 tests and privacy gates. Final milestone complete only after all approved PRs merge; **venue projector/PA rehearsal remains a separate manual gate**.
