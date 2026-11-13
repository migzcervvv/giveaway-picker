#!/usr/bin/env node
// Builds pr-<n>-bundle.md (PR metadata, CI status, task card, diff) for planner review.
// Usage: pnpm pr-bundle <pr-number>   Needs GitHub CLI.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const n = process.argv[2];
if (!n || !/^\d+$/.test(n)) {
  console.error('usage: pnpm pr-bundle <pr-number>');
  process.exit(1);
}
const gh = (args) => {
  const r = spawnSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error || r.status !== 0) {
    console.error(`gh ${args.join(' ')} failed:\n${r.stderr || r.error}`);
    process.exit(1);
  }
  return r.stdout;
};

const meta = JSON.parse(gh([
  'pr', 'view', n, '--json',
  'title,body,headRefName,baseRefName,additions,deletions,changedFiles,statusCheckRollup,url',
]));

const MAX = 150000;
const skip = /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/;
const chunks = gh(['pr', 'diff', n]).split(/^(?=diff --git )/m);
let diff = '';
const omitted = [];
for (const c of chunks) {
  const file = (c.match(/^diff --git a\/(\S+)/) ?? [])[1] ?? '';
  if (skip.test(file) || /^Binary files /m.test(c)) { omitted.push(`${file} (lockfile/binary)`); continue; }
  if (diff.length + c.length > MAX) { omitted.push(`${file} (size cap)`); continue; }
  diff += c;
}

const idMatch = meta.headRefName.match(/codex\/(T\d+|V\d+-\d+)-/);
let card = '(task card not found; branch name does not match codex/<TaskID>-<slug>)';
if (idMatch && existsSync('docs/tasks')) {
  const f = readdirSync('docs/tasks').find((x) => x.startsWith(`${idMatch[1]}-`));
  if (f) card = `docs/tasks/${f}\n\n${readFileSync(`docs/tasks/${f}`, 'utf8').trim()}`;
}

const checks = (meta.statusCheckRollup ?? [])
  .map((c) => `- ${c.name ?? c.context}: ${c.conclusion ?? c.status ?? c.state}`)
  .join('\n') || '(no checks reported)';

const out = `# PR #${n}: ${meta.title}
${meta.url}
Branch: ${meta.headRefName} -> ${meta.baseRefName}
Size: +${meta.additions} -${meta.deletions}, ${meta.changedFiles} files

## CI checks
${checks}

## PR description
${(meta.body ?? '').trim() || '(empty)'}

## Task card
${card}

## Omitted from diff
${omitted.length ? omitted.map((o) => `- ${o}`).join('\n') : '(none)'}

## Diff
\`\`\`diff
${diff}
\`\`\`

## Review instruction
Use the verdict format in docs/PLANNER_PROTOCOL.md.
`;
const file = `pr-${n}-bundle.md`;
writeFileSync(file, out);
console.log(`${file} written: ${out.length} chars, about ${Math.round(out.length / 4)} tokens.`);
if (omitted.length) console.warn(`Omitted ${omitted.length} file(s); see "Omitted from diff".`);
