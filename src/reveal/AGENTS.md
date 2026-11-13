# src/reveal rules (animation)

The animation is a cosmetic replay of a result that already exists. It takes a `DrawResult` and plays it. It never calls `draw()`, never selects or reorders winners, and never mutates the result.

- Contract: `RevealMode` / `RevealHandle` in `docs/ARCHITECTURE.md` section 7. Every mode implements it exactly.
- Timeline: all modes are driven by the shared seekable timeline (`timeline.ts`) on one clock. Skip = fast-forward to the final state, not a hard cut. Pause on `visibilitychange`.
- Physics (Matter.js) is decoration. The winning ticket's path to the chute is scripted (tweened), not simulated.
- Cosmetic randomness only via `cosmetic.ts`. No `Math.random`.
- `prefers-reduced-motion`: render the fade-reveal fallback, no physics, no confetti, no shake.
- Budgets: 60 fps on a mid-range laptop with 60 visual bodies; canvas DPR capped at 2; no per-frame allocations in hot loops; no layout thrash.
- Cleanup: `destroy()` cancels RAF, removes listeners, disposes Matter engine and AudioNodes, clears canvas. A mode must be mountable and destroyable 50 times with no leak.
- Audio: WebAudio synthesis only (no audio files). Context resumes on the user's Draw click. Mute state respected everywhere.
- Visual pool: at most 60 names shown; must include every winner and backup; the rest are random decoys from the pool. The real pool size is always displayed as a counter.
- Assets: none external. Textures are canvas/SVG/CSS generated.
- `src/dev/RevealLab` must be able to run each mode with fake names and a fixed result for manual review.
