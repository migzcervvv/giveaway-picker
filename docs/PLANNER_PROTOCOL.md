# PLANNER_PROTOCOL.md

## Roles
| Role | Who | Owns |
|---|---|---|
| Owner | Miggz | Authorization and final control of merges; running the app; judging visual/animation quality; relaying between planner and Codex |
| Planner | Claude or ChatGPT | PLAN, ARCHITECTURE, DECISIONS, task card bodies, HANDOFF "Planner notes", PR verdicts |
| Programmer | Codex | Code, tests, task `status`, HANDOFF "Current state", PR creation; executing explicitly approved squash merges and local main sync per D-021 |

The planner reviews structure, correctness, fairness invariants, scope, and tests. The owner judges how the animation looks and feels. Diff-only review cannot see runtime behavior: supply CI status and, for UI/animation PRs, a one-line "looks right/wrong because" note.

## Loop
1. Planner marks a card `ready`. Owner sends Codex prompt P1 (docs/PROMPTS.md).
2. Codex opens a PR with label `planner-review`. Codex's GitHub auto-review (if enabled) comments first.
3. Owner runs `pnpm pr-bundle <n>` and sends planner prompt P5 plus the bundle. Public repo shortcut: give the planner `https://github.com/<owner>/<repo>/pull/<n>.diff`.
4. Planner replies in the verdict format below, identifying the reviewed head commit SHA.
5. `CHANGES REQUESTED`: owner sends Codex the "CODEX FIX PROMPT" block (P2). Same branch, new commits. Back to step 3.
6. `APPROVE`: after explicit owner delegation, Codex verifies the reviewed SHA, green required checks, and an unchanged PR before squash-merging. Codex deletes the task branch, fast-forward-syncs local `main` without losing local edits, and reports the merge SHA. If checks/head changed, stop for re-review. The owner may withhold or revoke delegation.
7. Planner confirms the merged state and prepares the next `ready` card. A docs-sync PR is reviewed and approved before Codex merges it by the same procedure.

## Verdict format (planner output, fixed)
```
VERDICT: APPROVE | CHANGES REQUESTED | BLOCKED
PR: #<n>   Task: <id>
Reviewed head SHA: <sha>
Blocking:
  B1. <file:line> <problem> -> <required fix>
Non-blocking:
  N1. <suggestion>
Scope: pass | fail (<files outside scope>)
Acceptance criteria: <id>: pass|fail ...
Invariants: RNG | engine purity | no network | no persisted names | animation does not decide outcomes -> pass|fail each
Docs/handoff updated: yes | no
Next: <next task id or planner action>
CODEX FIX PROMPT:
<self-contained prompt, only when CHANGES REQUESTED>
```

## Planner Update Package
When a planner changes planner-owned files, it outputs each changed file in full, one fenced block per file, headed by its path. The owner has Codex apply them with prompt P3 (Codex docs-sync PR) or edits them in the GitHub web editor; approved docs-sync PRs may be merged by Codex per D-021. Planner never assumes an update landed until its merge is confirmed. Existing local changes must be preserved.

## Swapping planners (Claude <-> ChatGPT)
All state lives in the repo, so a new planner can resume from files alone.
1. Trigger at about 80% of the outgoing planner's budget. Do not wait for the cutoff.
2. Send wrap-up prompt P6 to the outgoing planner. It outputs a Planner Update Package: updated HANDOFF "Planner notes" and "Planner log", new DECISIONS entries, any edited task cards.
3. Apply the package (P3), review and merge.
4. Run `pnpm handoff` (use `pnpm handoff -- --lite` when the incoming context is tight). It writes `handoff-bundle.md`.
5. Open the incoming planner. Send onboarding prompt P4, then paste `handoff-bundle.md`.
6. The incoming planner replies with a READY CHECK (12 lines max): state, last merged task, open PRs, pending decisions, next action. Owner compares with HANDOFF.md. Fix mismatches before continuing.
7. Incoming planner appends a "Planner log" line on its first Planner Update Package.

Rules
- Decisions that exist only in chat are lost on swap. Write them to DECISIONS.md before the session ends.
- One active planner per PR at a time.
- A new planner changes PLAN/ARCHITECTURE only through a new DECISIONS entry, never by silent rewrite.
- ChatGPT or Claude may not be able to read a private repo: the bundle scripts exist for that. Pinned project files (AGENTS, PLAN, ARCHITECTURE) in a Claude/ChatGPT Project save tokens but go stale; re-upload after any change.
