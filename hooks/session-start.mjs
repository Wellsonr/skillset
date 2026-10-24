// SessionStart warn-only hook: read-only drift check, never mutates, ALWAYS exits 0. Silent when fresh or input malformed.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { checkDrift } from '../scripts/scan.mjs';
import { readJson, readInstalledUserPlugins, defaultPaths } from '../scripts/lib.mjs';

export function sessionStartCheck({ pluginsFile = defaultPaths().pluginsFile, dataDir = defaultPaths().dataDir } = {}) {
  try {
    const installed = readInstalledUserPlugins(pluginsFile);
    const catalogFile = join(dataDir, 'catalog.json');
    if (!existsSync(catalogFile)) {
      return { message: 'skillset: catalog.json belum ada — jalankan /skillset:init untuk membuat katalog.' };
    }
    const catalog = readJson(catalogFile);
    const { fresh, changes } = checkDrift(installed, catalog);
    if (fresh) return { message: '' };
    if (changes.some((c) => c.type === 'missing-catalog')) {
      return { message: 'skillset: catalog.json belum ada — jalankan /skillset:init untuk membuat katalog.' };
    }
    return { message: `skillset: ${changes.length} perubahan instalasi terdeteksi — jalankan /skillset:update untuk memperbarui katalog.` };
  } catch {
    return { message: '' }; // malformed/unreadable state -> stay silent
  }
}

export async function main() {
  try {
    const { message } = sessionStartCheck();
    if (message) console.log(message);
  } catch {
    // a hook failure must never break the user's session
  }
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('session-start.mjs')) {
  process.exit(await main());
}
