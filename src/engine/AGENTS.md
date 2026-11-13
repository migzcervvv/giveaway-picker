# src/engine rules

Pure TypeScript. Imports nothing from react, react-dom, dexie, zustand, other `src/` dirs, or DOM-only globals (`window`, `document`, `localStorage`). `globalThis.crypto` (getRandomValues, subtle) is allowed.

- Public API only through `src/engine/index.ts`. Other dirs import from `@/engine`, never deep paths.
- Every exported function has unit tests. Cover: empty input, single item, boundary counts (N = pool size, N + M = pool size), invalid config, unicode, very large input (100k names normalize + dedupe in under 500 ms in a test).
- RNG is injectable: functions that randomize take a `RandomSource` parameter defaulting to `cryptoSource`. Tests use a seeded source from `src/engine/test-utils.ts` (test-only, not exported from index).
- Errors: throw typed errors (`DrawConfigError` with `code`), never strings. No silent clamping inside engine; clamping is a UI concern.
- No I/O, no timers, no global mutable state. Functions do not mutate their inputs.
- Async only where the platform requires it (`crypto.subtle` hashing).
- Determinism: same input + same RandomSource output = same result. Document any exception in a code comment.
