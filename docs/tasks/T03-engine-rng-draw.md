---
id: T03
title: Engine: rng, draw
status: in-review
depends_on: [T02]
branch: codex/T03-engine-rng-draw
---
# T03 Engine: rng, draw

## Goal
Secure, unbiased, testable winner selection.

## Read first
ARCHITECTURE sections 3 (rng, draw); `src/engine/AGENTS.md`; DECISIONS D-001, D-012.

## Scope
- `src/engine/rng.ts`, `draw.ts`, `test-utils.ts` (seeded `RandomSource` such as mulberry32; test-only, not exported from index), colocated tests.
- Export from `index.ts`: `cryptoSource`, `uniformInt`, `partialShuffle`, `randomFloat`, `draw`, `DrawConfigError`.

## Out of scope
Lifecycle, pool exclusion (T04), hashing, UI, animation.

## Spec
- `cryptoSource.nextUint32()` uses `crypto.getRandomValues(new Uint32Array(1))`. Buffer a small batch (for example 256 values) to limit calls; behavior must be identical to unbuffered.
- `uniformInt(n, rng)`: throws `RangeError` unless `1 <= n <= 2^32` and integer. Rejection sampling per ARCHITECTURE section 3. Never use `%` on the raw value without the rejection step.
- `partialShuffle(items, count, rng)`: returns `count` distinct items, uniformly random ordered sample; input not mutated; `count > items.length` throws `RangeError`.
- `randomFloat(rng)`: `nextUint32() / 2^32`.
- `draw(pool, cfg, rng)`: validates (`WINNERS_MIN` if winners < 1 or not integer, `BACKUPS_NEG`, `EMPTY_POOL`, `EXCEEDS_POOL` if winners + backups > pool length). Samples `winners + backups` entrants with `partialShuffle`; first N are winners in order, next M are backups in order. Input pool unchanged.

## Acceptance criteria
- [ ] Rejection test: a stub `RandomSource` returning values at or above `limit` first proves the value is rejected and re-drawn (assert call count).
- [ ] Uniformity test: `uniformInt(7)` over 200,000 draws with `cryptoSource`; chi-square statistic below 40 (df = 6; chosen to make flakes negligible); comment explains the threshold.
- [ ] Permutation uniformity test with the seeded source: `partialShuffle([a,b,c], 3)` over 60,000 runs, each of 6 permutations within 5% of expected.
- [ ] Determinism test: same seeded source and same input produce the same `DrawResult`.
- [ ] No duplicates between winners and backups; N = pool size and N + M = pool size work.
- [ ] Every `DrawConfigError` code has a test.
- [ ] `grep -r "Math.random" src` returns nothing.

## Required tests
As above.

## PR notes
Reviewer will read `uniformInt` line by line.
