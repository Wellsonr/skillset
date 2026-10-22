import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateManifest, diffManifest, buildInstallCmd, buildUpdateCmd, runSync } from '../scripts/sync.mjs';
import { writeJson } from '../scripts/lib.mjs';

const installed = [
  { key: 'b@m2', installPath: '/x', version: '1' },
  { key: 'a@m1', installPath: '/y', version: '2' },
];

test('generateManifest sorts keys with autoUpdate true', () => {
  assert.deepEqual(generateManifest(installed), { autoUpdate: true, plugins: ['a@m1', 'b@m2'] });
});

test('diffManifest splits missing vs present', () => {
  const d = diffManifest({ autoUpdate: true, plugins: ['a@m1', 'c@m3'] }, installed);
  assert.deepEqual(d.missing, ['c@m3']);
  assert.deepEqual(d.present, ['a@m1']);
});

test('buildInstallCmd and buildUpdateCmd shapes', () => {
  assert.deepEqual(buildInstallCmd('c@m3'), ['claude', 'plugin', 'install', 'c@m3']);
  assert.deepEqual(buildUpdateCmd('a@m1'), ['claude', 'plugin', 'update', 'a@m1']);
});

test('runSync dry-run builds commands without spawning', () => {
  let spawned = 0;
  const spawn = () => { spawned++; return { status: 0, stdout: '', stderr: '' }; };
  const dir = mkdtempSync(join(tmpdir(), 'skillset-sync-'));
  const manifestFile = join(dir, 'manifest.json');
  writeJson(manifestFile, { autoUpdate: true, plugins: ['a@m1', 'c@m3'] });
  const pluginsFile = join(dir, 'installed.json');
  writeFileSync(pluginsFile, JSON.stringify({ plugins: {
    'a@m1': [{ scope: 'user', installPath: '/y', version: '2' }],
  }}));
  const result = runSync({ manifestFile, pluginsFile, dryRun: true, spawn });
  assert.equal(spawned, 0);
  assert.deepEqual(result.dryRunCommands, [
    ['claude', 'plugin', 'install', 'c@m3'],
    ['claude', 'plugin', 'marketplace', 'update'],
    ['claude', 'plugin', 'update', 'a@m1'],
    ['claude', 'plugin', 'update', 'c@m3'],
  ]);
  rmSync(dir, { recursive: true, force: true });
});

test('runSync reports per-plugin failure without throwing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillset-sync-'));
  const manifestFile = join(dir, 'manifest.json');
  writeJson(manifestFile, { autoUpdate: true, plugins: ['a@m1'] });
  const pluginsFile = join(dir, 'installed.json');
  writeFileSync(pluginsFile, JSON.stringify({ plugins: {
    'a@m1': [{ scope: 'user', installPath: '/y', version: '2' }],
  }}));
  const spawn = (cmd) => cmd[1] === 'plugin' && cmd[2] === 'update'
    ? { status: 1, stdout: '', stderr: 'network down' }
    : { status: 0, stdout: '', stderr: '' };
  const result = runSync({ manifestFile, pluginsFile, dryRun: false, spawn });
  assert.deepEqual(result.failed, [{ key: 'a@m1', error: 'network down' }]);
  rmSync(dir, { recursive: true, force: true });
});
