import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sessionStartCheck } from '../hooks/session-start.mjs';

test('sessionStartCheck: fresh silent, drift suggests update, missing catalog suggests init, malformed silent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillset-hook-'));
  const dataDir = join(dir, 'data');
  const pluginsFile = join(dir, 'installed_plugins.json');
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(pluginsFile, JSON.stringify({ plugins: {} }));
  writeFileSync(join(dataDir, 'catalog.json'), JSON.stringify({ generatedAt: new Date().toISOString(), plugins: [], duplicates: [] }));
  assert.equal(sessionStartCheck({ pluginsFile, dataDir }).message, '');
  writeFileSync(join(dataDir, 'catalog.json'), JSON.stringify({ generatedAt: new Date().toISOString(), plugins: [{ name: 'a', marketplace: 'm', version: '1.0.0' }], duplicates: [] }));
  writeFileSync(pluginsFile, JSON.stringify({ plugins: { 'a@m': [{ scope: 'user', installPath: join(dir, 'x'), version: '2.0.0' }] } }));
  assert.match(sessionStartCheck({ pluginsFile, dataDir }).message, /\/skillset:update/);
  writeFileSync(pluginsFile, JSON.stringify({ plugins: {} }));
  rmSync(join(dataDir, 'catalog.json'));
  assert.match(sessionStartCheck({ pluginsFile, dataDir }).message, /\/skillset:init/);
  writeFileSync(pluginsFile, '{broken');
  assert.equal(sessionStartCheck({ pluginsFile, dataDir }).message, '');
  rmSync(dir, { recursive: true, force: true });
});

test('hooks.json valid & wired to session-start.mjs', () => {
  const j = JSON.parse(readFileSync(new URL('../hooks/hooks.json', import.meta.url), 'utf8'));
  const entry = j.hooks.SessionStart[0];
  assert.match(entry.matcher, /startup/);
  assert.match(entry.hooks[0].command, /session-start\.mjs/);
});
