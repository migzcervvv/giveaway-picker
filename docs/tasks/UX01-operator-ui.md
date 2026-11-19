---
id: UX01
title: The Lucky Draw — operator usability and design foundation
status: in-review
depends_on: [T10b]
branch: codex/UX01-operator-ui
---

# UX01 — Stage 1A: Operator interface

> Planner-authorized 2026-11-19 under D-028. **Start only after approved PR #23 (T10b) is merged.** In this same code PR: add UX01, UX02 and UX03 approved cards; append D-028 verbatim to DECISIONS; update HANDOFF Codex current state/index; set UX01 to in-review. No documentation-only PR.

## Goal
A clear, polished, genuinely usable **operator interface** for a live raffle: configure, import, draw, process winners, and find history without confusion. Style direction **"The Lucky Draw"**: refined dark navy/charcoal, restrained champagne-gold accent, high-contrast text, generous spacing, subtle stage atmosphere. Entertaining but not grandiose.

## Scope
- `src/ui/theme.css`, `src/ui/App.tsx`, existing `src/ui/screens/{InputScreen,WinnersScreen,HistoryScreen}.tsx` and existing shared UI components; focused tests. Minimal DOM rearrangement and CSS, not a rewrite.
- Keep existing typography or self-hosted bundled fonts. No new image/font fetches, frontend component framework, Material/CSS engine, external library, backend or global state architecture.
- Show an obvious flow: (1) Entrants/import, (2) Draw setup, (3) Draw / winners, with compact navigation and visible progression, draw readiness/error states, clear statuses, large enough targets for projector/laptop operation. History is secondary but discoverable.
- Preserve full original functionality: CSV/XLSX picker, paste, settings, counts, progress, history, JSON/CSV/XLSX downloads, mark called/no-show, promotion, undo, repeat rounds. Don't hide essential controls behind decoration.
- Make copy concise and accurate; **do not advertise offline-installable PWA yet**.
- Prepare reusable theme tokens/card/typography styles for the audience stage; avoid enormous CSS or duplicative components.

## Acceptance
- At 390, 768, 1440 and 1920px: no horizontal overflow, legible text, unambiguous primary CTA, 44px-ish keyboard/click targets, visible focus, understandable locked/loading/error/success states.
- On an operator's laptop, one can import or paste, configure N winners/M backups, draw, mark called/no-show, see backup promotion, return for next round and open History without losing state.
- Long names, 50k-name imported list, wide XLSX preview, empty/invalid states, one-at-a-time mode and reduced motion still function. No unexpected disclosure, new persistent entrant data or network.
- Tests for navigation, state retention, correct disabled actions and critical responsive structure. `pnpm verify` and green required CI; browser walkthrough + screenshots for operator, mobile and wide screen.
- **No animations/presentation stage yet.** Stage work belongs to UX02/UX03.
- D-023 ~400 changed non-test lines target, stop-and-split >500; tests/fixtures excluded. Separate implementation PR and SHA-bound review/merge under D-021.
