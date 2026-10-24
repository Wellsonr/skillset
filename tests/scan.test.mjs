import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanPlugins, checkDrift, findDuplicates, renderCatalogMd, main } from '../scripts/scan.mjs';

function makeFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'skillset-scan-'));
  const dataDir = join(dir, 'data');
  const pluginsFile = join(dir, 'installed_plugins.json');
  const pluginRoot = join(dir, 'plugins', 'demo-plugin');
  mkdirSync(join(pluginRoot, 'skills', 'alpha'), { recursive: true });
  mkdirSync(join(pluginRoot, 'skills', 'beta'), { recursive: true });
  mkdirSync(join(pluginRoot, 'commands'), { recursive: true });
  mkdirSync(join(pluginRoot, 'agents'), { recursive: true });
  writeFileSync(join(pluginRoot, 'skills', 'alpha', 'SKILL.md'),
    '---\nname: alpha\ndescription: One-line skill\n---\n');
  writeFileSync(join(pluginRoot, 'skills', 'beta', 'SKILL.md'),
    '---\nname: beta\ndescription: Long description spanning\n  two lines with "quotes"\n---\n');
  writeFileSync(join(pluginRoot, 'commands', 'go.md'),
    '---\ndescription: Run the go command\n---\n');
  writeFileSync(join(pluginRoot, 'agents', 'helper.md'),
    '---\nname: helper\ndescription: Helps\n---\n');
  writeFileSync(pluginsFile, JSON.stringify({ plugins: {
    'demo-plugin@demo-market': [{ scope: 'user', installPath: pluginRoot, version: '1.2.3' }],
    'ghost-plugin@demo-market': [{ scope: 'user', installPath: join(dir, 'missing'), version: '0.0.1' }],
  }}));
  return { dir, dataDir, pluginsFile };
}

test('scanPlugins catalogs skills, commands, agents; joins multi-line descriptions', () => {
  const { pluginsFile, dir } = makeFixture();
  const catalog = scanPlugins({ pluginsFile });
  assert.deepEqual(catalog.skipped, ['ghost-plugin@demo-market']);
  const demo = catalog.plugins.find((p) => p.name === 'demo-plugin');
  assert.equal(demo.version, '1.2.3');
  assert.deepEqual(demo.skills.map((s) => s.name), ['alpha', 'beta']);
  assert.equal(demo.skills[1].description, 'Long description spanning two lines with "quotes"');
  assert.equal(demo.commands[0].name, 'go');
  assert.equal(demo.agents[0].name, 'helper');
  rmSync(dir, { recursive: true, force: true });
});

test('checkDrift detects version change, addition, removal, and freshness', () => {
  const installed = [
    { key: 'a@m', version: '2.0.0' },
    { key: 'b@m', version: '1.0.0' },
  ];
  const stale = { plugins: [
    { name: 'a', marketplace: 'm', version: '1.0.0' },
    { name: 'c', marketplace: 'm', version: '1.0.0' },
  ]};
  const r = checkDrift(installed, stale);
  assert.equal(r.fresh, false);
  const types = r.changes.map((c) => `${c.type}:${c.key}`).sort();
  assert.deepEqual(types, ['added:b@m', 'removed:c@m', 'version:a@m']);
  const freshCatalog = { plugins: [
    { name: 'a', marketplace: 'm', version: '2.0.0' },
    { name: 'b', marketplace: 'm', version: '1.0.0' },
  ]};
  assert.equal(checkDrift(installed, freshCatalog).fresh, true);
});

test('check fails cleanly when catalog missing', () => {
  const r = checkDrift([{ key: 'a@m', version: '1' }], null);
  assert.equal(r.fresh, false);
  assert.deepEqual(r.changes, [{ type: 'missing-catalog' }]);
});

test('renderCatalogMd includes plugin header and one-line entries', () => {
  const { pluginsFile, dir } = makeFixture();
  const md = renderCatalogMd(scanPlugins({ pluginsFile }));
  assert.match(md, /## demo-plugin \(demo-market, 1\.2\.3\)/);
  assert.match(md, /\*\*alpha\*\* — One-line skill/);
  rmSync(dir, { recursive: true, force: true });
});

test('CLI --check exits 1 when catalog is missing', async () => {
  const { dataDir, pluginsFile, dir } = makeFixture();
  const code = await main(['--check', '--data-dir', dataDir, '--plugins-file', pluginsFile]);
  assert.equal(code, 1);
  rmSync(dir, { recursive: true, force: true });
});

test('CLI scan writes catalog.json and catalog.md', async () => {
  const { dataDir, pluginsFile, dir } = makeFixture();
  const code = await main(['--data-dir', dataDir, '--plugins-file', pluginsFile]);
  assert.equal(code, 0);
  const catalog = JSON.parse(readFileSync(join(dataDir, 'catalog.json'), 'utf8'));
  assert.equal(catalog.plugins.length, 1);
  assert.ok(existsSync(join(dataDir, 'catalog.md')));
  rmSync(dir, { recursive: true, force: true });
});

test('findDuplicates: same normalized name across plugins flagged; same-plugin ignored', () => {
  const catalog = { plugins: [
    { name: 'a', marketplace: 'm1', skills: [{ name: 'Review', description: 'Review code changes' }], commands: [], agents: [] },
    { name: 'b', marketplace: 'm2', skills: [{ name: 'review', description: 'Totally different domain stuff' }], commands: [], agents: [] },
  ]};
  const d = findDuplicates(catalog);
  assert.equal(d.length, 1);
  assert.equal(d[0].sameName, true);
  assert.deepEqual([d[0].a, d[0].b].sort(), ['a:Review', 'b:review']);
});

test('findDuplicates: jaccard >= threshold flagged, dissimilar not, empty catalog -> []', () => {
  const catalog = { plugins: [
    { name: 'a', marketplace: 'm1', skills: [{ name: 'tdd', description: 'test driven development write tests first' }], commands: [], agents: [] },
    { name: 'b', marketplace: 'm2', skills: [{ name: 'tdd-guide', description: 'test driven development write the test first always' }], commands: [], agents: [] },
    { name: 'c', marketplace: 'm3', skills: [{ name: 'paint', description: 'mix colors on canvas' }], commands: [], agents: [] },
  ]};
  const d = findDuplicates(catalog, { threshold: 0.6 });
  assert.equal(d.length, 1);
  assert.deepEqual([d[0].a, d[0].b].sort(), ['a:tdd', 'b:tdd-guide']);
  assert.equal(d[0].sameName, false);
  assert.deepEqual(findDuplicates({ plugins: [] }), []);
  assert.deepEqual(findDuplicates({ plugins: [{ name: 'x', skills: [{ name: 's', description: '' }], commands: [], agents: [] }] }), []);
});

test('scanPlugins includes duplicates field; renderCatalogMd renders Duplicates section', () => {
  const { pluginsFile, dir } = makeFixture();
  const catalog = scanPlugins({ pluginsFile });
  assert.deepEqual(catalog.duplicates, []);
  const withDup = { ...catalog, duplicates: [{ a: 'a:tdd', b: 'b:tdd-guide', kind: 'skill', similarity: 0.6, sameName: false }] };
  const md = renderCatalogMd(withDup);
  assert.match(md, /## Duplicates/);
  assert.match(md, /a:tdd ↔ b:tdd-guide/);
  rmSync(dir, { recursive: true, force: true });
});
