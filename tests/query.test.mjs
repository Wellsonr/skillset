import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreEntries, formatResults, summarize } from '../scripts/query.mjs';

const catalog = { generatedAt: '2026-10-22T00:00:00.000Z', plugins: [
  { name: 'superpowers', marketplace: 'off', version: '6.4.1',
    skills: [
      { name: 'brainstorming', description: 'Turn ideas into designs' },
      { name: 'tdd', description: 'Test driven development workflow' },
    ],
    commands: [], agents: [] },
  { name: 'mattpocock-skills', marketplace: 'off', version: '1.0.0',
    skills: [{ name: 'tdd', description: 'Write tests first' }],
    commands: [], agents: [] },
]};

test('scores by exact/substring name and description', () => {
  const rows = scoreEntries(catalog, ['tdd']);
  assert.equal(rows.length, 2);
  assert.ok(rows[0].score >= 3);
});

test('formatResults groups by kind with plugin prefix', () => {
  const out = formatResults(scoreEntries(catalog, ['tdd']));
  assert.match(out, /superpowers:tdd — Test driven development workflow/);
  assert.match(out, /mattpocock-skills:tdd — Write tests first/);
});

test('drops zero-score entries', () => {
  const rows = scoreEntries(catalog, ['nonexistent-keyword']);
  assert.equal(rows.length, 0);
});

test('summarize lists per-plugin counts', () => {
  assert.match(summarize(catalog), /superpowers \(off, 6\.4\.1\) — 2 skills, 0 commands, 0 agents/);
});

test('formatResults truncates long descriptions to the lean limit by default', () => {
  const long = 'x'.repeat(300);
  const rows = [{ kind: 'skill', plugin: 'p', name: 'n', description: long, score: 1 }];
  const out = formatResults(rows);
  assert.ok(out.includes('x'.repeat(119) + '…'));
  assert.ok(!out.includes('x'.repeat(121)));
});

test('formatResults keeps full descriptions with { full: true }', () => {
  const long = 'x'.repeat(300);
  const out = formatResults([{ kind: 'skill', plugin: 'p', name: 'n', description: long, score: 1 }], { full: true });
  assert.ok(out.includes(long));
});

test('main defaults to top 5 and --full restores top 12', async () => {
  const { mkdtempSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { main } = await import('../scripts/query.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'skillset-q-'));
  const skills = Array.from({ length: 20 }, (_, i) => ({ name: `s${i}`, description: 'alpha ' + 'd'.repeat(200) }));
  writeFileSync(join(dir, 'catalog.json'), JSON.stringify({ plugins: [{ name: 'p', skills, commands: [], agents: [] }] }));
  const run = (args) => {
    const lines = [];
    const orig = console.log;
    console.log = (s) => lines.push(String(s));
    try { main(['alpha', '--data-dir', dir, '--json', ...args]); } finally { console.log = orig; }
    return JSON.parse(lines.join('\n'));
  };
  assert.equal(run([]).length, 5);
  assert.equal(run(['--full']).length, 12);
  assert.equal(run(['--top', '3']).length, 3);
});
