import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateTokens, renderBars, findSkillFile } from '../scripts/bench.mjs';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('estimateTokens approximates bytes / 4', () => {
  assert.equal(estimateTokens(4000), 1000);
  assert.equal(estimateTokens(0), 0);
});

test('renderBars scales widths to the max value and escapes labels', () => {
  const svg = renderBars({ title: 'T & <x>', rows: [
    { label: 'big', value: 1000 },
    { label: 'small', value: 250, accent: true },
  ] });
  assert.match(svg, /^<svg /);
  assert.match(svg, /T &amp; &lt;x&gt;/);
  const widths = [...svg.matchAll(/class="bar[^"]*" [^>]*width="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.equal(widths.length, 2);
  assert.ok(Math.abs(widths[1] / widths[0] - 0.25) < 0.01);
  assert.match(svg, /prefers-color-scheme: dark/);
});

test('findSkillFile locates nested skills and commands but skips node_modules', () => {
  const root = mkdtempSync(join(tmpdir(), 'bench-'));
  mkdirSync(join(root, 'skills/eng/tdd'), { recursive: true });
  writeFileSync(join(root, 'skills/eng/tdd/SKILL.md'), 'x');
  mkdirSync(join(root, 'commands'), { recursive: true });
  writeFileSync(join(root, 'commands/commit.md'), 'x');
  mkdirSync(join(root, 'node_modules/p/skills/ghost'), { recursive: true });
  writeFileSync(join(root, 'node_modules/p/skills/ghost/SKILL.md'), 'x');
  assert.match(findSkillFile(root, 'tdd'), /skills\/eng\/tdd\/SKILL\.md$/);
  assert.match(findSkillFile(root, 'commit'), /commands\/commit\.md$/);
  assert.equal(findSkillFile(root, 'ghost'), null);
});
