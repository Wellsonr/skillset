import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateManifest, diffManifest, buildInstallCmd, buildUpdateCmd, runSync, main } from '../scripts/sync.mjs';
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
  const spawn = (cmd, args) => args[0] === 'plugin' && args[1] === 'update'
    ? { status: 1, stdout: '', stderr: 'network down' }
    : { status: 0, stdout: '', stderr: '' };
  const result = runSync({ manifestFile, pluginsFile, dryRun: false, spawn });
  assert.deepEqual(result.failed, [{ key: 'a@m1', error: 'network down' }]);
  rmSync(dir, { recursive: true, force: true });
});

test('runSync passes command string, args array, utf8 encoding to spawn', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillset-sync-'));
  const manifestFile = join(dir, 'manifest.json');
  writeJson(manifestFile, { autoUpdate: true, plugins: ['c@m3'] });
  const pluginsFile = join(dir, 'installed.json');
  writeFileSync(pluginsFile, JSON.stringify({ plugins: {
    'a@m1': [{ scope: 'user', installPath: '/y', version: '2' }],
  }}));
  const calls = [];
  const spawn = (cmd, args, opts) => { calls.push([cmd, args, opts]); return { status: 0, stdout: '', stderr: '' }; };
  runSync({ manifestFile, pluginsFile, dryRun: false, spawn });
  assert.ok(calls.length > 0, 'spawn should be called');
  for (const [cmd, args, opts] of calls) {
    assert.equal(typeof cmd, 'string', `command must be a string, got ${typeof cmd}`);
    assert.ok(Array.isArray(args), 'args must be an array');
    assert.equal(opts.encoding, 'utf8');
  }
  assert.deepEqual(calls[0][1], ['plugin', 'install', 'c@m3']);
  rmSync(dir, { recursive: true, force: true });
});

test('runSync stringifies Buffer stderr in failed entries', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillset-sync-'));
  const manifestFile = join(dir, 'manifest.json');
  writeJson(manifestFile, { autoUpdate: true, plugins: ['a@m1'] });
  const pluginsFile = join(dir, 'installed.json');
  writeFileSync(pluginsFile, JSON.stringify({ plugins: {
    'a@m1': [{ scope: 'user', installPath: '/y', version: '2' }],
  }}));
  const spawn = (cmd, args) => args && args[0] === 'plugin' && args[1] === 'update'
    ? { status: 1, stdout: Buffer.from('boom out'), stderr: Buffer.from('boom err') }
    : { status: 0, stdout: '', stderr: '' };
  const result = runSync({ manifestFile, pluginsFile, dryRun: false, spawn });
  assert.deepEqual(result.failed, [{ key: 'a@m1', error: 'boom err' }]);
  rmSync(dir, { recursive: true, force: true });
});

test('runSync reports spawn r.error (ENOENT) instead of exit null', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillset-sync-'));
  const manifestFile = join(dir, 'manifest.json');
  writeJson(manifestFile, { autoUpdate: true, plugins: ['a@m1'] });
  const pluginsFile = join(dir, 'installed.json');
  writeFileSync(pluginsFile, JSON.stringify({ plugins: {
    'a@m1': [{ scope: 'user', installPath: '/y', version: '2' }],
  }}));
  const spawn = () => ({ status: null, error: new Error('spawn claude ENOENT') });
  const result = runSync({ manifestFile, pluginsFile, dryRun: false, spawn });
  assert.ok(
    result.failed.some((f) => f.key === 'a@m1' && f.error === 'spawn claude ENOENT'),
    `a@m1 ENOENT entry missing in: ${JSON.stringify(result.failed)}`
  );
  rmSync(dir, { recursive: true, force: true });
});

test('runSync turns spawn throw into failed entries without aborting', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillset-sync-'));
  const manifestFile = join(dir, 'manifest.json');
  writeJson(manifestFile, { autoUpdate: true, plugins: ['a@m1', 'c@m3'] });
  const pluginsFile = join(dir, 'installed.json');
  writeFileSync(pluginsFile, JSON.stringify({ plugins: {
    'a@m1': [{ scope: 'user', installPath: '/y', version: '2' }],
  }}));
  const result = runSync({ manifestFile, pluginsFile, dryRun: false, spawn: () => { throw new Error('boom spawn'); } });
  assert.deepEqual(result.installed, []);
  assert.deepEqual(result.updated, []);
  assert.equal(result.failed.length, 3);
  assert.ok(result.failed.every((f) => f.error === 'boom spawn'), JSON.stringify(result.failed));
  rmSync(dir, { recursive: true, force: true });
});

test('runSync keeps partial results when one spawn call throws', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillset-sync-'));
  const manifestFile = join(dir, 'manifest.json');
  writeJson(manifestFile, { autoUpdate: true, plugins: ['a@m1', 'c@m3'] });
  const pluginsFile = join(dir, 'installed.json');
  writeFileSync(pluginsFile, JSON.stringify({ plugins: {
    'a@m1': [{ scope: 'user', installPath: '/y', version: '2' }],
  }}));
  const spawn = (cmd, args) => {
    if (args[1] === 'marketplace') throw new Error('boom marketplace');
    return { status: 0, stdout: '', stderr: '' };
  };
  const result = runSync({ manifestFile, pluginsFile, dryRun: false, spawn });
  assert.deepEqual(result.installed, ['c@m3']);
  assert.deepEqual(result.updated, ['a@m1', 'c@m3']);
  assert.deepEqual(result.failed, [{ key: 'marketplace', error: 'boom marketplace' }]);
  rmSync(dir, { recursive: true, force: true });
});

test('main labels unreadable installed.json with file path, not sync gagal', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillset-sync-'));
  writeJson(join(dir, 'manifest.json'), { autoUpdate: true, plugins: ['a@m1'] });
  const pluginsFile = join(dir, 'installed.json');
  writeFileSync(pluginsFile, '{corrupt');
  const errs = [];
  const origError = console.error;
  console.error = (msg) => errs.push(String(msg));
  let code;
  try {
    code = main(['--data-dir', dir, '--plugins-file', pluginsFile]);
  } finally {
    console.error = origError;
  }
  assert.equal(code, 2);
  const output = errs.join('\n');
  assert.ok(output.includes('tidak bisa dibaca'), `expected read-failure label in: ${output}`);
  assert.ok(output.includes(pluginsFile), `expected file path in: ${output}`);
  assert.ok(!output.includes('sync gagal'), `sync gagal mislabel leaked: ${output}`);
  rmSync(dir, { recursive: true, force: true });
});

test('main distinguishes manifest IO error from invalid JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillset-sync-'));
  mkdirSync(join(dir, 'manifest.json'));
  const pluginsFile = join(dir, 'installed.json');
  writeFileSync(pluginsFile, JSON.stringify({ plugins: {} }));
  const errs = [];
  const origError = console.error;
  console.error = (msg) => errs.push(String(msg));
  let code;
  try {
    code = main(['--data-dir', dir, '--plugins-file', pluginsFile]);
  } finally {
    console.error = origError;
  }
  assert.equal(code, 2);
  const output = errs.join('\n');
  assert.ok(output.includes('manifest.json tidak bisa dibaca'), `expected IO label in: ${output}`);
  assert.ok(!output.includes('tidak valid'), `invalid-JSON label leaked: ${output}`);
  rmSync(dir, { recursive: true, force: true });
});

test('runSync records marketplace update failure without blocking', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillset-sync-'));
  const manifestFile = join(dir, 'manifest.json');
  writeJson(manifestFile, { autoUpdate: true, plugins: ['a@m1', 'c@m3'] });
  const pluginsFile = join(dir, 'installed.json');
  writeFileSync(pluginsFile, JSON.stringify({ plugins: {
    'a@m1': [{ scope: 'user', installPath: '/y', version: '2' }],
  }}));
  const spawn = (cmd, args) => args[1] === 'marketplace'
    ? { status: 1, stdout: '', stderr: 'mp down' }
    : { status: 0, stdout: '', stderr: '' };
  const result = runSync({ manifestFile, pluginsFile, dryRun: false, spawn });
  assert.deepEqual(result.installed, ['c@m3']);
  assert.deepEqual(result.updated, ['a@m1', 'c@m3']);
  assert.deepEqual(result.failed, [{ key: 'marketplace', error: 'mp down' }]);
  rmSync(dir, { recursive: true, force: true });
});

test('main keeps manifest tidak valid label for malformed manifest JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillset-sync-'));
  writeFileSync(join(dir, 'manifest.json'), '{not json');
  const pluginsFile = join(dir, 'installed.json');
  writeFileSync(pluginsFile, JSON.stringify({ plugins: {} }));
  const errs = [];
  const origError = console.error;
  console.error = (msg) => errs.push(String(msg));
  let code;
  try {
    code = main(['--data-dir', dir, '--plugins-file', pluginsFile]);
  } finally {
    console.error = origError;
  }
  assert.equal(code, 2);
  assert.ok(errs.join('\n').includes('manifest.json tidak valid'));
  rmSync(dir, { recursive: true, force: true });
});
