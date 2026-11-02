// Fails when package.json, ENGINE_VERSION and (optionally) a release tag disagree.
// Usage: node scripts/check-version.mjs [vX.Y.Z]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const source = readFileSync(join(root, 'src/index.ts'), 'utf8');
const match = source.match(/export const ENGINE_VERSION = '([^']+)';/);
const engineVersion = match?.[1];
const tag = process.argv[2];

const problems = [];
if (!engineVersion) problems.push('ENGINE_VERSION was not found in src/index.ts');
else if (engineVersion !== version)
  problems.push(`ENGINE_VERSION is ${engineVersion}, package.json says ${version}`);
if (tag !== undefined && tag !== `v${version}`)
  problems.push(`tag ${tag} does not match package.json version ${version} (expected v${version})`);

if (problems.length > 0) {
  for (const problem of problems) console.error(`version check: ${problem}`);
  process.exit(1);
}
console.log(`version check: ${tag ?? `v${version}`} matches package.json and ENGINE_VERSION`);
