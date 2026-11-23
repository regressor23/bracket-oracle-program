import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (path: string) => readFileSync(root + path, 'utf8');

/** SHA-256 of the canonical text at https://www.apache.org/licenses/LICENSE-2.0.txt. */
const APACHE_2_SHA256 = 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30';

describe('license', () => {
  it('ships the unmodified Apache License 2.0', () => {
    const text = read('LICENSE');
    expect(createHash('sha256').update(text).digest('hex')).toBe(APACHE_2_SHA256);
  });

  it.each([
    'package.json',
    'packages/engine/package.json',
    'packages/verify/package.json',
    'tests/package.json',
  ])('%s declares Apache-2.0', (path) => {
    expect((JSON.parse(read(path)) as { license?: string }).license).toBe('Apache-2.0');
  });

  it('the program crate declares Apache-2.0', () => {
    expect(read('programs/bracket_oracle/Cargo.toml')).toMatch(/^license = "Apache-2\.0"$/m);
  });
});
