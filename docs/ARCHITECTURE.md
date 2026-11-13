# ARCHITECTURE.md (planner-owned)

## 1. Layers
```
ui -> store -> engine
ui -> reveal -> engine (types only)
ui -> io -> engine
store -> db -> engine (types only)
```
`engine` imports nothing from the app. Enforced by ESLint `no-restricted-imports` per directory.

## 2. Folder structure
```
/
  AGENTS.md  README.md  package.json  pnpm-lock.yaml  .nvmrc
  vite.config.ts  tsconfig.json  eslint.config.js  .prettierrc
  .github/{pull_request_template.md, workflows/ci.yml}
  docs/{PLAN,ARCHITECTURE,DECISIONS,HANDOFF,PLANNER_PROTOCOL,PROMPTS,SETUP}.md
  docs/tasks/   docs/templates/
  scripts/{setup-github,handoff-bundle,pr-bundle}.mjs
  e2e/          Playwright specs
  src/
    engine/     types, normalize, paste, dedupe, rng, draw, lifecycle, hash, record, index, test-utils
    io/         import (worker, sheet, column), export (json, csv, xlsx)
    db/         schema, repos
    store/      session, settings, history
    reveal/     types, timeline, visualPool, cosmetic, audio, drum/, reel/, wheel/, fallback/
    ui/         app shell, screens (Input, Config, Reveal, Winners, History), components, theme
    dev/        RevealLab
    main.tsx
```
Path alias `@/` -> `src/`.

## 3. Engine API (src/engine)
```ts
// types.ts
export type Entrant = { id: string; name: string; key: string };   // name = display, key = dedupe key
export interface RandomSource { nextUint32(): number }
export type DrawConfig = { winners: number; backups: number };
export type DrawResult = { winners: Entrant[]; backups: Entrant[] };
export type BuildStats = { rawCount: number; blankDropped: number; duplicatesRemoved: number; finalCount: number };
export type BuildResult = { entrants: Entrant[]; stats: BuildStats; duplicates: { name: string; count: number }[] };

// normalize.ts
export const NORMALIZATION_VERSION = 1;
export function normalizeName(raw: string, opts?: { foldDiacritics?: boolean }): { display: string; key: string } | null; // null if blank

// paste.ts
export function splitPaste(text: string): string[];
export function looksTabular(text: string): boolean;

// dedupe.ts
export function buildEntrants(rawNames: readonly string[], opts: { dedupe: boolean; foldDiacritics: boolean }): BuildResult;

// rng.ts
export const cryptoSource: RandomSource;
export function uniformInt(maxExclusive: number, rng?: RandomSource): number;   // rejection sampling
export function partialShuffle<T>(items: readonly T[], count: number, rng?: RandomSource): T[]; // Fisher-Yates, non-mutating
export function randomFloat(rng?: RandomSource): number;                         // [0,1), cosmetic use

// draw.ts
export class DrawConfigError extends Error { code: 'WINNERS_MIN' | 'BACKUPS_NEG' | 'EXCEEDS_POOL' | 'EMPTY_POOL' }
export function draw(pool: readonly Entrant[], cfg: DrawConfig, rng?: RandomSource): DrawResult;

// lifecycle.ts  (section 5)   hash.ts, record.ts  (section 6)
```
Normalization rules: display = trimmed, whitespace-collapsed, NFC, case preserved from first occurrence. key = NFKC, whitespace-collapsed, lowercased; with `foldDiacritics`, NFD then strip `\p{M}`. Dedupe keeps first occurrence, preserves input order.

Paste rules: always split on newlines. Only when the text has no newline, also split on tab, semicolon, comma. `looksTabular` is true when over half of non-empty lines contain a tab (UI then offers the column picker).

RNG rules: `uniformInt(n)`: `limit = 2^32 - (2^32 % n)`; draw until `x < limit`; return `x % n`. Valid for 1 <= n <= 2^32. `partialShuffle` performs `count` Fisher-Yates swaps on a copy.

## 4. State and persistence
- `session` store (memory only): raw text, entrants, build stats, duplicates list, pool state, current draw, reveal state.
- `settings` store (localStorage, non-entrant data only): sound on/off, reveal mode, theme, dedupe, foldDiacritics, removeCalled, one-at-a-time.
- IndexedDB (Dexie) table `draws`:
```ts
type DrawRecord = {
  id: string;               // uuid
  createdAt: string;        // ISO
  entrantCount: number; rawCount: number; blankDropped: number; duplicatesRemoved: number;
  listHash: string;         // sha256 hex
  normalizationVersion: number;
  config: DrawConfig & { dedupe: boolean; foldDiacritics: boolean; removeCalled: boolean };
  slots: Slot[];            // winners then backups, as drawn
  events: DrawEvent[];      // append-only
};
```
No raw entrant list is stored. Winner and backup names are stored (they are the record).

## 5. Lifecycle (src/engine/lifecycle.ts)
```ts
type Slot = { rank: number; role: 'winner' | 'backup'; entrantId: string; name: string };
type DrawEvent =
  | { id: string; at: string; type: 'DRAWN'; slots: Slot[] }
  | { id: string; at: string; type: 'CALLED'; rank: number }
  | { id: string; at: string; type: 'NO_SHOW'; rank: number }
  | { id: string; at: string; type: 'PROMOTED'; backupRank: number; replacesRank: number }
  | { id: string; at: string; type: 'EXHAUSTED'; replacesRank: number }
  | { id: string; at: string; type: 'UNDONE'; targetEventId: string };
type SlotStatus = 'pending' | 'called' | 'no_show' | 'standby' | 'promoted';
function deriveState(events: readonly DrawEvent[]): { slots: (Slot & { status: SlotStatus; replacedBy?: number })[]; exhausted: number[] };
function applyAction(events: readonly DrawEvent[], action: Action, now: string, newId: () => string): DrawEvent[]; // returns events to append
```
Rules: NO_SHOW on a winner (or a promoted backup) appends PROMOTED for the lowest-rank `standby` backup, else EXHAUSTED. CALLED on a non-pending slot is rejected. UNDONE targets the latest non-undone event and removes its dependent PROMOTED/EXHAUSTED events from the derived state. The log is never edited or deleted; undo is an event.

Pool rules for the next draw (decision D-006): exclude entrants that are `called` (when `removeCalled`), `no_show` (always), and any `pending` or `standby` in an earlier open draw (always). Everyone else stays eligible.

## 6. Hash and record (src/engine/hash.ts, record.ts)
`hashEntrants(entrants)`: SHA-256 (hex) of `String(NORMALIZATION_VERSION) + "\n" + keys.sort(codepointCompare).join("\n")`. Use `a < b`, not `localeCompare`. A third party can reproduce the hash from the list.
Export record JSON: `{ schema: 1, drawId, createdAt, listHash, hashAlgo: "sha256", normalizationVersion, counts, config, slots, events, finalStatus }`. CSV: one row per slot with rank, role, name, final status. xlsx: sheets `Summary`, `Slots`, `Events`.

## 7. Reveal architecture (src/reveal)
```ts
export type RevealInput = {
  result: DrawResult;            // final, immutable
  visualPool: string[];          // <= 60 names, contains every winner and backup
  poolSize: number;              // real entrant count, shown in HUD
  reducedMotion: boolean;
  sound: SoundController;
  oneAtATime: boolean;
};
export type RevealHooks = { onSlotRevealed(rank: number, role: 'winner' | 'backup'): void };
export interface RevealHandle { skip(): void; pause(): void; resume(): void; done: Promise<void>; destroy(): void }
export interface RevealMode { id: 'drum' | 'reel' | 'wheel'; mount(host: HTMLElement, input: RevealInput, hooks: RevealHooks): RevealHandle }
```
- `timeline.ts`: seekable, pausable timeline on one clock (`performance.now` with pause offset). Steps are `{start, duration, onUpdate(t), onEnter, onExit}`. Seeking to the end applies all final states. Skip = fast-forward at 8x then settle.
- `visualPool.ts`: builds the 60-name set from the result plus decoys sampled through the engine RNG. Decoys never include duplicates of a winner's name.
- `cosmetic.ts`: `rand()`, `randRange()`, wrapping engine `randomFloat`.
- `audio.ts`: WebAudio synthesis: tick (short filtered click), thunk (low noise burst), rise (sweep), fanfare (chord). `SoundController { tick(rate), thunk(), rise(t), fanfare(), setMuted(b) }`. Context resumes on the Draw click.
- `fallback/`: reduced-motion reveal: crossfade names in rank order, no canvas.

### Drum timeline (single winner, about 10 s; later winners compress to about 4 s; backups about 1.5 s each)
| t | Phase | Visual | Audio |
|---|---|---|---|
| 0.0-0.8 | Intro | drum rolls in; paper tickets with names; counter "1,284 entrants" | soft whoosh |
| 0.8-2.3 | Spin-up | angular velocity eased in; tickets tumble (gravity vector rotates with drum angle) | ticks accelerate |
| 2.3-5.0 | Full spin | motion blur on labels; contender strip at the chute flashes the name currently passing | rapid ticks |
| 5.0-7.0 | Deceleration | ease-out; vignette tightens; contender strip slows | ticks slow; rise |
| 7.0-7.8 | Selection | winner ticket (pre-tagged body) leaves the pack on a scripted spline to the chute; others pushed away | thunk |
| 7.8-8.6 | Ejection | ticket drops from chute, one bounce, centers | clack |
| 8.6-9.5 | Unfold | ticket opens with 3D rotateX; name letters stagger in; rank badge stamps | fanfare |
| 9.5+ | Burst + hold | confetti in theme colors; spotlight; hold for Next or auto-advance | |
HUD throughout: entrant counter, winner slots 1..N filling with ticket thumbnails as revealed.

### Reel
One vertical strip per winner (up to 5 per batch; more winners = sequential batches). Strip = shuffled visual pool with the winner placed at the stop index. Staggered deceleration 0.6 s apart; each lock has a thunk and a flash. Backups use a smaller single reel.

### Wheel
Segments = winners + decoys, at most 40 (modes disabled above that pool size, or segments sampled). Pointer fixed. Target angle = center of the winner segment plus a full-rotation count plus in-segment jitter. Ease-out cubic with tick per segment boundary crossed.

## 8. Theme and design
Dark, cinematic, editorial (MIGGZ). Tokens as CSS variables: `--bg #0A0A0B`, `--surface #121214`, `--ink #F4EFE6`, `--muted #8A857B`, `--accent #FFB020`, `--danger #E5484D`, `--ok #3DD68C`. One display serif and one mono from `@fontsource`, chosen in T01 and recorded in HANDOFF. Winner name in large display type, full-bleed. Light theme optional in T17.

## 9. Performance budgets
Initial JS under 250 KB gzip excluding lazy chunks. SheetJS, Matter.js, confetti lazy-loaded. 100k-name paste: normalize + dedupe in a Web Worker, UI stays responsive. Reveal canvas capped at DPR 2.

## 10. Privacy and security
No runtime network calls. CSP in the built `index.html`: `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; worker-src 'self' blob:`. Names rendered as text only (no `innerHTML`). Spreadsheet formulas never evaluated. CSV export prefixes cells starting with `= + - @` with a single quote to block formula injection.
