---
id: T11
title: Reveal framework, audio, RevealLab
status: stub
depends_on: [T08]
branch: codex/T11-reveal-framework
---
# T11 Reveal framework, audio, RevealLab

STUB. Codex must not start this card. Planner expands it (prompt P7) before dispatch.

## Intent
Implement ARCHITECTURE section 7 scaffolding: `RevealMode` contract, seekable pausable timeline, visualPool, cosmetic rand, WebAudio synth SoundController with mute, reduced-motion fallback reveal, skip, and `src/dev/RevealLab` (reachable at `#lab`) to run each mode with fake names and a fixed result.
## Key acceptance
- Timeline unit tests (seek, pause, skip-to-end applies final state).
- visualPool test: at most 60 names, contains every winner and backup, no decoy equals a winner name.
- Mount/destroy x50 leak test.
