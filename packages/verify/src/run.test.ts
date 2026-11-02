import { hashCanonical, sha256Hex, theInternational } from '@bracket-oracle/engine';
import { describe, expect, it } from 'vitest';
import { run } from './run.js';

const files: Record<string, string> = {
  'bracket.json': '{ "slot": "grand-final", "pick": "Team B", "round": 3 }',
  'broken.json': '{ "slot": ',
  'ti.json': JSON.stringify(theInternational),
  'playoffs.json': JSON.stringify({
    format: 'pgl-wallachia',
    stage: 'playoffs',
    results: {
      positions: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      series: {
        'ubqf-1': { team1: 'A', team2: 'B', score1: 2, score2: 1 },
        'ubqf-2': { team1: 'D', team2: 'C', score1: 2, score2: 0 },
      },
    },
  }),
  'wrong-teams.json': JSON.stringify({
    format: 'pgl-wallachia',
    stage: 'playoffs',
    results: {
      positions: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      series: { 'ubqf-1': { team1: 'A', team2: 'C', score1: 2, score2: 0 } },
    },
  }),
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

  it('prints the outcomes of a bracket from results', async () => {
    const result = await run(['outcomes', 'playoffs.json'], read);
    expect(result.code).toBe(0);
    const lines = result.stdout.split('\n');
    expect(lines[0]).toBe('pgl-wallachia v1, playoffs (bracket)');
    expect(lines).toContain('ubqf-1: A vs B 2-1 → A');
    expect(lines).toContain('ubqf-2: C vs D 0-2 → D');
    expect(lines).toContain('ubsf-1: A vs D');
    expect(lines).toContain('lbr1-1: B vs C');
    expect(lines).toContain('champion: not decided');
  });

  it('fails with the issues when results do not fit the bracket', async () => {
    const result = await run(['outcomes', 'wrong-teams.json'], read);
    expect(result.code).toBe(1);
    expect(result.stderr).toBe('ubqf-1: result is A vs C, the slot holds A vs B');
  });

  it('prints usage for unknown commands', async () => {
    const result = await run(['roots'], read);
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/Usage/);
  });
});
