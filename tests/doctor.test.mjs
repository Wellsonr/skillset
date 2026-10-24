import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { doctorChecks, main } from '../scripts/doctor.mjs';

function okInputs() {
  return {
    catalog: { generatedAt: new Date().toISOString(), plugins: [], duplicates: [] },
    installed: [],
    manifest: { autoUpdate: true, plugins: [] },
    hasRules: true,
  };
}

test('doctorChecks: healthy inputs all ok', () => {
  const checks = doctorChecks(okInputs());
  assert.equal(checks.some((c) => c.status !== 'ok'), false);
});

test('doctorChecks: stale catalog warns; future generatedAt stays ok', () => {
  const stale = doctorChecks({ ...okInputs(), catalog: { generatedAt: '2020-01-01T00:00:00.000Z', plugins: [], duplicates: [] }, now: new Date('2026-10-24T00:00:00.000Z') });
  assert.ok(stale.find((c) => c.id === 'catalog' && c.status === 'warn'));
  const future = doctorChecks({ ...okInputs(), catalog: { generatedAt: '2999-01-01T00:00:00.000Z', plugins: [], duplicates: [] }, now: new Date('2026-10-24T00:00:00.000Z') });
  assert.equal(future.find((c) => c.id === 'catalog').status, 'ok');
});

test('doctorChecks: drift, manifest-missing-entry, no-rules, duplicates, src-mismatch warn', () => {
  const r = doctorChecks({
    catalog: { generatedAt: new Date().toISOString(), plugins: [{ name: 'a', marketplace: 'm', version: '1.0.0', skills: [], commands: [], agents: [] }], duplicates: [{ a: 'x:s', b: 'y:s', kind: 'skill', similarity: 1, sameName: true }] },
    installed: [{ key: 'a@m', version: '2.0.0' }],
    manifest: { autoUpdate: true, plugins: ['ghost@zz'] },
    hasRules: false,
    srcVersion: '0.2.0', installedVersion: '0.1.1',
  });
  const ids = Object.fromEntries(r.map((c) => [c.id, c.status]));
  assert.equal(ids.drift, 'warn');
  assert.equal(ids.manifest, 'warn');
  assert.equal(ids.rules, 'warn');
  assert.equal(ids.duplicates, 'warn');
  assert.equal(ids['skillset-src'], 'warn');
  assert.equal(ids.catalog, 'ok');
});

test('doctor main: invalid catalog exits 2; healthy dir exits 0; --json prints checks', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillset-doctor-'));
  const dataDir = join(dir, 'data');
  const pluginsFile = join(dir, 'installed_plugins.json');
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(pluginsFile, JSON.stringify({ plugins: {} }));
  writeFileSync(join(dataDir, 'catalog.json'), '{invalid');
  const errs = [];
  const logs = [];
  const origError = console.error;
  const origLog = console.log;
  console.error = (msg) => errs.push(String(msg));
  console.log = (msg) => logs.push(String(msg));
  try {
    assert.equal(await main(['--data-dir', dataDir, '--plugins-file', pluginsFile]), 2);
    writeFileSync(join(dataDir, 'catalog.json'), JSON.stringify({ generatedAt: new Date().toISOString(), plugins: [], duplicates: [] }));
    writeFileSync(join(dataDir, 'manifest.json'), JSON.stringify({ autoUpdate: true, plugins: [] }));
    writeFileSync(join(dataDir, 'rules.md'), '# rules\n');
    assert.equal(await main(['--data-dir', dataDir, '--plugins-file', pluginsFile]), 0);
    assert.equal(await main(['--data-dir', dataDir, '--plugins-file', pluginsFile, '--json']), 0);
  } finally {
    console.error = origError;
    console.log = origLog;
  }
  rmSync(dir, { recursive: true, force: true });
});
