/**
 * Remove @duckdb/node-bindings-* packages that do not match the current
 * platform so the VSIX only ships one native binding (~70 MB vs ~550 MB).
 */
import { readdirSync, rmSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const duckdbDir = join(root, 'node_modules/@duckdb');

function isLinuxMusl() {
  try {
    const { familySync, MUSL } = require('detect-libc');
    return familySync() === MUSL;
  } catch {
    return false;
  }
}

function getBindingDirName() {
  const { platform, arch } = process;
  if (platform === 'linux') {
    const musl = isLinuxMusl();
    if (arch === 'x64') {
      return musl ? 'node-bindings-linux-x64-musl' : 'node-bindings-linux-x64';
    }
    if (arch === 'arm64') {
      return musl ? 'node-bindings-linux-arm64-musl' : 'node-bindings-linux-arm64';
    }
  }
  return `node-bindings-${platform}-${arch}`;
}

if (!existsSync(duckdbDir)) {
  console.log('No @duckdb packages found; skipping prune.');
  process.exit(0);
}

const keep = getBindingDirName();
let removed = 0;

for (const name of readdirSync(duckdbDir)) {
  if (!name.startsWith('node-bindings-') || name === 'node-bindings') {
    continue;
  }
  if (name === keep) {
    continue;
  }
  const target = join(duckdbDir, name);
  rmSync(target, { recursive: true, force: true });
  removed += 1;
  console.log(`Removed ${name}`);
}

console.log(`Keeping ${keep} (${removed} other binding package(s) pruned).`);
