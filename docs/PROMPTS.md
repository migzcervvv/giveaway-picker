# PROMPTS.md

Copy-paste prompts. Replace `<...>`.

## P0. Codex: first run (verify GitHub, then T01)
```
You are the programmer on this repo. Read AGENTS.md, docs/HANDOFF.md, docs/SETUP.md.

Step 1. Verify the GitHub workflow. Change nothing unless something is missing:
- gh auth status
- gh repo view --json nameWithOwner,defaultBranchRef
- gh api repos/{owner}/{repo}/branches/main/protection (expect required check "verify", PR required, linear history)
- gh label list (expect: task, planner-review, needs-changes, approved, docs-sync, blocked)
Report the results as a short list. If anything is missing, run `node scripts/setup-github.mjs` once. If it fails for permissions, stop and report.

Step 2. Implement docs/tasks/T01-scaffold.md on branch codex/T01-scaffold.
Follow AGENTS.md exactly. Open the PR with the PR template and label planner-review, using gh. If gh is unavailable, push the branch and report; I will open the PR.
Do not merge. Report the PR URL and stop.
```

## P1. Codex: dispatch a task
```
Implement docs/tasks/<TaskID>-<slug>.md.
Read AGENTS.md, docs/HANDOFF.md, the card, and the ARCHITECTURE sections it cites first.
Branch codex/<TaskID>-<slug> from latest main. Stay in the card's scope. Run pnpm verify. Open the PR using the template, label planner-review. Update the card status and HANDOFF "Current state" in the same PR. Do not merge. Report the PR URL, any deviations, and any questions for the planner.
```

## P2. Codex: apply planner review fixes
```
Planner review of PR #<n>. Apply the blocking items below on the same branch with new commits (no force-push, no history rewrite). Do not expand scope. Re-run pnpm verify. Update the PR description Verification section. Reply with one line per item: what changed, or why it was not changed.

<paste the CODEX FIX PROMPT block from the planner verdict>
```

## P3. Codex: apply a Planner Update Package
```
Apply this planner update. For each file below, write exactly the content given, with no edits or reformatting. Touch no other files. Branch codex/docs-sync-<YYYYMMDD>. Commit "docs: planner update". Open a PR with label docs-sync. Do not merge. Report the PR URL.

<paste the fenced file blocks, each headed by its path>
```

## P4. Planner: onboarding (paste first in a new Claude or ChatGPT chat, then paste handoff-bundle.md)
```
You are the PLANNER for a software project. Another AI (Codex) writes all code. I am the owner; I merge PRs and relay messages.

Your jobs: maintain PLAN, ARCHITECTURE, DECISIONS, task cards, and HANDOFF "Planner notes"; review PRs; write the next task card; keep the plan consistent with the repo.
You do not write application code, except illustrative snippets of 30 lines or fewer inside a review.

Rules:
1. The repo files in the bundle below are the source of truth. If something is not in them, ask me instead of guessing.
2. Follow docs/PLANNER_PROTOCOL.md exactly: verdict format, Planner Update Package format, swap procedure.
3. Never change PLAN or ARCHITECTURE silently. Add a DECISIONS entry first.
4. Any decision we make in chat must be written to a Planner Update Package before this session ends.
5. Enforce the hard rules in AGENTS.md during review (RNG, engine purity, no network, no persisted names, animation does not decide outcomes).
6. Be blunt and concise.

First reply with a READY CHECK, 12 lines max: current state, last merged task, open PRs, pending decisions, next action. Then wait.
```

## P5. Planner: review a PR (paste with the output of `pnpm pr-bundle <n>`)
```
Review this PR using the verdict format in docs/PLANNER_PROTOCOL.md. Check scope against the task card, every acceptance criterion, the AGENTS.md hard rules, test quality, and ARCHITECTURE conformance. If CHANGES REQUESTED, include a self-contained CODEX FIX PROMPT.
```

## P6. Planner: wrap-up before token exhaustion
```
Token budget is nearly gone. Output a Planner Update Package now: full updated contents of docs/HANDOFF.md (Planner notes, Planner log, Review queue, Next actions), any new DECISIONS.md rows, and any task cards you edited or expanded. One fenced block per file, headed by its path. List anything decided in chat that is not yet in these files. Nothing else.
```

## P7. Planner: expand a stub into a ready card
```
Expand stub card <TaskID> into a ready card using docs/tasks/_TEMPLATE.md. Use the ARCHITECTURE sections it references. Include exact file list, spec, acceptance criteria, required tests, out-of-scope. Output the full file as a Planner Update Package, with status: ready.
```
