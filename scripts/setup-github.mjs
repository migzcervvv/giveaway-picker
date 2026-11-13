#!/usr/bin/env node
// One-time GitHub setup. Usage: node scripts/setup-github.mjs [repo-name] [--public|--private]
// Needs: git, GitHub CLI (`gh auth login` done). Safe to re-run.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith('--')) ?? 'giveaway-picker';
const visibility = args.includes('--private') ? 'private' : 'public';

function run(cmd, a, input) {
  return spawnSync(cmd, a, { encoding: 'utf8', input });
}
function must(cmd, a, input) {
  const r = run(cmd, a, input);
  if (r.error || r.status !== 0) {
    console.error(`FAILED: ${cmd} ${a.join(' ')}\n${r.stderr || r.error}`);
    process.exit(1);
  }
  return (r.stdout || '').trim();
}
function soft(label, cmd, a, input) {
  const r = run(cmd, a, input);
  if (r.error || r.status !== 0) {
    console.warn(`WARN ${label}: ${String(r.stderr || r.error).trim()}`);
    return false;
  }
  console.log(`ok   ${label}`);
  return true;
}

must('gh', ['auth', 'status']);

if (!existsSync('.git')) must('git', ['init', '-b', 'main']);
if (run('git', ['rev-parse', '--verify', 'HEAD']).status !== 0) {
  must('git', ['add', '-A']);
  must('git', ['commit', '-m', 'chore: planner kit']);
}
must('git', ['branch', '-M', 'main']);

if (run('git', ['remote', 'get-url', 'origin']).status !== 0) {
  must('gh', ['repo', 'create', name, `--${visibility}`, '--source=.', '--remote=origin', '--push']);
} else {
  must('git', ['push', '-u', 'origin', 'main']);
}
const nwo = must('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']);
console.log(`repo ${nwo}`);

soft('squash-only merges, auto-delete branches', 'gh', [
  'repo', 'edit', nwo,
  '--enable-squash-merge',
  '--enable-merge-commit=false',
  '--enable-rebase-merge=false',
  '--delete-branch-on-merge',
]);

const labels = [
  ['task', '1D76DB', 'Implements a task card'],
  ['planner-review', 'FBCA04', 'Awaiting planner verdict'],
  ['needs-changes', 'D93F0B', 'Planner requested changes'],
  ['approved', '2EA44F', 'Planner approved; owner may merge'],
  ['docs-sync', '5319E7', 'Planner update package'],
  ['blocked', 'B60205', 'Blocked'],
];
for (const [n, color, desc] of labels) {
  soft(`label ${n}`, 'gh', ['label', 'create', n, '--color', color, '--description', desc, '--force', '--repo', nwo]);
}

const protection = {
  required_status_checks: { strict: false, contexts: ['verify'] },
  enforce_admins: true,
  required_pull_request_reviews: { required_approving_review_count: 0 },
  restrictions: null,
  required_linear_history: true,
  allow_force_pushes: false,
  allow_deletions: false,
};
const protectedOk = soft('branch protection on main', 'gh', [
  'api', '-X', 'PUT', `repos/${nwo}/branches/main/protection`,
  '-H', 'Accept: application/vnd.github+json',
  '--input', '-',
], JSON.stringify(protection));
if (!protectedOk) {
  console.warn('Branch protection failed. Private repos may need a paid plan. Workflow still works by convention: never push to main.');
}

console.log(`\nDone. Next:
 1. Codex settings: connect ${nwo}, enable Code review (and Automatic reviews).
 2. Send Codex prompt P0 from docs/PROMPTS.md.`);
