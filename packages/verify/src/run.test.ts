import { sha256Hex } from '@bracket-oracle/engine';
import { describe, expect, it } from 'vitest';
import { run } from './run.js';

const files: Record<string, string> = {
  'bracket.json': '{ "slot": "grand-final", "pick": "Team B", "round": 3 }',
  'broken.json': '{ "slot": ',
};
const read = async (path: string) => {
  const content = files[path];
  if (content === undefined) throw new Error('ENOENT');
  return content;
};

describe('verify CLI', () => {
  it('hashes a file through canonical JSON', async () => {
    const result = await run(['hash', 'bracket.json'], read);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe(sha256Hex('{"pick":"Team B","round":3,"slot":"grand-final"}'));
  });

  it('fails clearly on invalid JSON', async () => {
    const result = await run(['hash', 'broken.json'], read);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/Cannot hash broken.json/);
  });

  it('prints usage for unknown commands', async () => {
    const result = await run(['roots'], read);
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/Usage/);
  });
});
