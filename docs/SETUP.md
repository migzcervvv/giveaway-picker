# SETUP.md (one-time, owner)

## Prerequisites
Node (current LTS), git, GitHub CLI. Then:
```
corepack enable
gh auth login
```

## 1. Create the repo and GitHub workflow
Unzip the kit into an empty folder, then:
```
node scripts/setup-github.mjs giveaway-picker --public
```
Use `--private` for a private repo. The script: initializes git, commits the kit to `main`, creates the GitHub repo and pushes, enforces squash-merge only with auto-delete of merged branches, creates labels, and protects `main` (PR required, status check `verify` required, linear history, no force-push, admins included, 0 required approvals).
Caveat: branch protection on private repos may require a paid GitHub plan. If the API rejects it, the script warns and continues; the rest of the workflow still works by convention.
Public repo advantage: any planner can read `https://github.com/<owner>/<repo>/pull/<n>.diff` directly.

## 2. Codex on GitHub
1. Set up Codex cloud and connect the repository (Codex settings).
2. Turn on Code review for the repository. Turn on Automatic reviews to get a Codex review on every new PR. `@codex review` in a PR comment triggers one manually. Codex reads the "Code Review Rules" section of AGENTS.md.
3. Codex cloud environment setup command: `corepack enable && pnpm install --frozen-lockfile`. T10 installs SheetJS from a tarball URL; if installs fail in Codex cloud, check the environment's setup and internet-access settings.
4. Local Codex (CLI/IDE) with `gh` authenticated can push branches and open PRs itself. Codex cloud opens PRs through its GitHub connection; add the `planner-review` label by hand if it did not.

## 3. Verify Codex reads the instructions
```
codex --ask-for-approval never "Summarize the current instructions."
```
Instruction files must stay under 32 KiB combined (Codex default `project_doc_max_bytes`; excess is silently truncated). Check: `wc -c AGENTS.md src/*/AGENTS.md`.

## 4. Start
Send Codex prompt P0 from `docs/PROMPTS.md`. Then follow `docs/PLANNER_PROTOCOL.md`.
