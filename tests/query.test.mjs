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
