#!/usr/bin/env node
// Builds handoff-bundle.md for pasting into a new planner chat.
// Usage: pnpm handoff            (full)
//        pnpm handoff -- --lite  (skips PLAN and ARCHITECTURE)
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const lite = process.argv.includes('--lite');
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8').trim() : `(missing: ${p})`);
const sh = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : `(unavailable: ${cmd} ${args.join(' ')})`;
};
const fm = (text, key) => (text.match(new RegExp(`^${key}:\\s*(.+?)\\s*(#.*)?$`, 'm')) ?? [])[1] ?? '';

const taskFiles = existsSync('docs/tasks')
  ? readdirSync('docs/tasks').filter((f) => /^(T|V)\d/.test(f)).sort()
  : [];
const cards = taskFiles.map((f) => {
  const t = readFileSync(`docs/tasks/${f}`, 'utf8');
  return { file: f, id: fm(t, 'id'), title: fm(t, 'title'), status: fm(t, 'status'), text: t };
});
const index = cards.map((c) => `- ${c.id} [${c.status}] ${c.title}`).join('\n');
const active = cards.find((c) => ['in-progress', 'in-review', 'ready'].includes(c.status));

const parts = [
  ['HANDOFF.md', read('docs/HANDOFF.md')],
  ['DECISIONS.md', read('docs/DECISIONS.md')],
  ['PLANNER_PROTOCOL.md', read('docs/PLANNER_PROTOCOL.md')],
  ['AGENTS.md', read('AGENTS.md')],
  ['Task index (from card frontmatter)', index || '(none)'],
  [`Active card: ${active ? active.file : 'none'}`, active ? active.text.trim() : '(none)'],
  ['Open PRs (gh)', sh('gh', ['pr', 'list', '--state', 'open', '--json', 'number,title,headRefName,labels', '-q', '.[] | "#\\(.number) \\(.title) [\\(.headRefName)]"']) || '(none)'],
  ['Recent commits on main', sh('git', ['log', 'main', '--oneline', '-15'])],
];
if (!lite) {
  parts.splice(3, 0, ['PLAN.md', read('docs/PLAN.md')], ['ARCHITECTURE.md', read('docs/ARCHITECTURE.md')]);
}

const out = `# Handoff bundle (${lite ? 'lite' : 'full'}) generated ${new Date().toISOString()}\n\n` +
  parts.map(([h, b]) => `\n---\n## ${h}\n\n${b}\n`).join('');
writeFileSync('handoff-bundle.md', out);
console.log(`handoff-bundle.md written: ${out.length} chars, about ${Math.round(out.length / 4)} tokens.`);
if (out.length > 120000) console.warn('Large bundle. Re-run with: pnpm handoff -- --lite');
