import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseFrontmatter, readInstalledUserPlugins, parseCliArgs } from '../scripts/lib.mjs';

test('parses simple frontmatter', () => {
  const md = '---\nname: demo\ndescription: short desc\n---\nbody';
  assert.deepEqual(parseFrontmatter(md), { name: 'demo', description: 'short desc' });
});

test('parses multi-line description with quotes and em-dash', () => {
  const md = '---\nname: demo\ndescription: Use when building things\n  that need "quotes" and — dashes\n---\n';
  const fm = parseFrontmatter(md);
  assert.equal(fm.name, 'demo');
  assert.equal(fm.description, 'Use when building things that need "quotes" and — dashes');
});

test('returns empty object when no frontmatter', () => {
  assert.deepEqual(parseFrontmatter('# plain'), {});
});

test('picks only user-scope entry per key', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillset-lib-'));
  const f = join(dir, 'installed_plugins.json');
  writeFileSync(f, JSON.stringify({ version: 2, plugins: {
    'superpowers@claude-plugins-official': [
      { scope: 'local', installPath: '/nope/local', version: '6.1.1' },
      { scope: 'user', installPath: '/cache/superpowers/6.4.1', version: '6.4.1' },
    ],
  }}));
  const list = readInstalledUserPlugins(f);
  assert.equal(list.length, 1);
  assert.deepEqual(list[0], {
    key: 'superpowers@claude-plugins-official',
    name: 'superpowers',
    marketplace: 'claude-plugins-official',
    installPath: '/cache/superpowers/6.4.1',
    version: '6.4.1',
  });
  rmSync(dir, { recursive: true, force: true });
});

test('handles key without @marketplace', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillset-lib-'));
  const f = join(dir, 'installed_plugins.json');
  writeFileSync(f, JSON.stringify({ plugins: {
    'my-skills-dir-plugin': [{ scope: 'user', installPath: '/x', version: '1.0.0' }],
  }}));
  const [p] = readInstalledUserPlugins(f);
  assert.equal(p.name, 'my-skills-dir-plugin');
  assert.equal(p.marketplace, '');
  rmSync(dir, { recursive: true, force: true });
});

test('parseCliArgs supports space, equals, and numeric flags', () => {
  const { flags, positional } = parseCliArgs([
    'keyword1', '--check', '--data-dir', '/tmp/d', '--top=20', 'keyword2',
  ]);
  assert.equal(flags.check, true);
  assert.equal(flags['data-dir'], '/tmp/d');
  assert.equal(flags.top, '20');
  assert.deepEqual(positional, ['keyword1', 'keyword2']);
});
