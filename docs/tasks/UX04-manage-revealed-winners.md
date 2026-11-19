---
id: UX04
title: Manage revealed winners between batches
status: in-review
depends_on: [UX03]
branch: codex/UX04-manage-revealed-winners
---

# UX04 — Manage revealed winners between batches

Source: [issue #27](https://github.com/migzcervvv/giveaway-picker/issues/27).

## Context
During UX03's PR #26 production Chrome walkthrough, seven-winner Minor draw showed six names, but the host could not mark them Called/No-show until the seventh was revealed. The shield while there are undisclosed slots protects privacy, but blocks stage management between batches (especially 30-winner prize portions).

## Objective
Allow processing **only previously revealed winners** between audience reveal batches. All unrevealed winners and standby/promoted backups must remain secret in the restricted operator DOM, accessible tree, live status and button labels.

## Narrow scope
- With outstanding secret names, Return to operator opens a restricted **Manage revealed winners** screen in the same tab, instead of full operator controls or an inert privacy shield.
- Display exactly the revealed slots for that draw ID with existing Called / No-show event actions (and valid scoped Undo if safe). Do not expose unrestricted History, roster, other draws, unseen slot names or backup identity.
- No-show may promote a backup in engine/history, but that backup's identity must **not appear** in alerts, announcements or operator screen until explicitly revealed on Audience View.
- Resume Audience View with correct disclosed progress; do not reset/reselect winners, alter persisted draw or skip the ordinary reveal.
- Safeguard against busy state, double clicks, stale asynchronous callbacks, generation changes and unmount.
- Real App + production browser tests: 7-winner and 30-winner rounds reveal first six, call one and mark one no-show, validate backend/history promotion, verify unshown seventh/backup names absent from DOM/AX and announcement, resume and explicitly reveal later winners/backup; verify repeat rounds, keyboard, reduced motion, no external requests.
- No new dependencies, redesign, multi-window support, backend or engine changes. Aim ≤400 changed non-test lines; >500 stop/split per D-023. `pnpm verify`, required CI and exact-SHA review before merge.

## Process
Separate focused follow-up after UX03 merge. Do not expand PR #26; do not claim venue/projector or PA testing without physical verification. Related PRs: #25 and #26.
