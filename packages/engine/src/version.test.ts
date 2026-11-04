import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from './index.js';

describe('ENGINE_VERSION', () => {
  it('matches the package version, so a release tag names both', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version: string;
    };
    expect(ENGINE_VERSION).toBe(pkg.version);
  });

  it('ships the replay fixtures, so the platform can replay the same events end to end', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      files: string[];
      exports: Record<string, unknown>;
    };
    expect(pkg.files).toContain('fixtures');
    expect(pkg.exports['./fixtures/replays/*.json']).toBe('./fixtures/replays/*.json');
  });
});
