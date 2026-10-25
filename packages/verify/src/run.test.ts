import { hashCanonical, sha256Hex, theInternational } from '@bracket-oracle/engine';
import { describe, expect, it } from 'vitest';
import { run } from './run.js';

const files: Record<string, string> = {
  'bracket.json': '{ "slot": "grand-final", "pick": "Team B", "round": 3 }',
  'broken.json': '{ "slot": ',
  'ti.json': JSON.stringify(theInternational),
  'bad-format.json': JSON.stringify({
    ...theInternational,
    rounds: { bracket: { stage: 'nope', lockMinutesBefore: 5 } },
  }),
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

  it('checks a format template and prints its hash and points', async () => {
    const result = await run(['format', 'ti.json'], read);
    expect(result.code).toBe(0);
    expect(result.stdout.split('\n')).toEqual([
      'ti v1 (dota2): valid',
      `sha256 ${hashCanonical(JSON.parse(files['ti.json']!))}`,
      'groups: group-stage, 16 picks, up to 190 points',
      'bracket: main-event, 14 picks, up to 195 points (+75 for exact scores)',
    ]);
  });

  it('lists every problem in an invalid format template', async () => {
    const result = await run(['format', 'bad-format.json'], read);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/^bad-format.json is not a valid format:/);
    expect(result.stderr).toMatch(/rounds\.bracket\.stage: unknown stage "nope"/);
    expect(result.stderr).toMatch(/stages\[0\]\.kind: no round predicts this stage/);
  });

  it('prints usage for unknown commands', async () => {
    const result = await run(['roots'], read);
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/Usage/);
  });
});
