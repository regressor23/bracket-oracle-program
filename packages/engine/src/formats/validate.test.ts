import { describe, expect, it } from 'vitest';
import { maxBasePoints, pickCount } from './points.js';
import type { BracketStage, FormatTemplate, SwissStage } from './schema.js';
import { pglWallachia, theInternational } from './templates.js';
import { swissRecordDistribution, validateFormat } from './validate.js';

/** A deep copy of a template to break on purpose. */
function copy(template: FormatTemplate): FormatTemplate {
  return structuredClone(template);
}

function issuesOf(input: unknown): string[] {
  const result = validateFormat(input);
  return result.ok ? [] : result.issues.map((issue) => `${issue.path}: ${issue.message}`);
}

function playoffs(template: FormatTemplate): BracketStage {
  const stage = template.stages.find((s) => s.kind === 'bracket');
  if (stage?.kind !== 'bracket') throw new Error('no bracket');
  return stage;
}

function swiss(template: FormatTemplate): SwissStage {
  const stage = template.stages.find((s) => s.kind === 'swiss');
  if (stage?.kind !== 'swiss') throw new Error('no swiss');
  return stage;
}

describe('validateFormat: shape', () => {
  it('reports schema problems with a readable path', () => {
    const broken = copy(pglWallachia) as unknown as { stages: { kind: string }[] };
    broken.stages[0]!.kind = 'ladder';
    expect(issuesOf(broken).join('\n')).toMatch(/^stages\[0\]\.kind: /m);
  });

  it('rejects unknown fields instead of ignoring them', () => {
    expect(issuesOf({ ...pglWallachia, prize: 1 })).toEqual(['<root>: Unrecognized key: "prize"']);
  });
});

describe('validateFormat: brackets', () => {
  it('needs every starting position exactly once', () => {
    const broken = copy(pglWallachia);
    playoffs(broken).slots[0]!.bottom = { position: 1 };
    expect(issuesOf(broken)).toEqual(
      expect.arrayContaining([
        'stages[1].slots: position 1 must start exactly once, found 2',
        'stages[1].slots: position 2 must start exactly once, found 0',
      ]),
    );
  });

  it('uses each result once and only from earlier slots', () => {
    const broken = copy(pglWallachia);
    const slots = playoffs(broken).slots;
    slots[5]!.top = { winnerOf: 'ubqf-1' }; // ubsf-2 takes the ubqf-1 winner as well
    slots[0]!.top = { winnerOf: 'gf' }; // and the first slot points forward
    expect(issuesOf(broken)).toEqual(
      expect.arrayContaining([
        'stages[1].slots[0].top: winner of gf: no earlier slot with this id',
        'stages[1].slots: the result of ubqf-1 is used 2 times',
      ]),
    );
  });

  it('drops every upper-bracket loser in double elimination, and only into the lower bracket', () => {
    const crossed = copy(pglWallachia);
    const ubf = playoffs(crossed).slots.find((slot) => slot.id === 'ubf')!;
    ubf.top = { loserOf: 'ubsf-1' };
    ubf.bottom = { winnerOf: 'lbqf-1' };
    expect(issuesOf(crossed)).toEqual(
      expect.arrayContaining([
        'stages[1].slots[10].top: only upper-bracket losers move, and only to the lower bracket',
        'stages[1].slots[10].bottom: the lower bracket cannot feed the upper side',
      ]),
    );

    const kept = copy(pglWallachia);
    playoffs(kept).slots.find((slot) => slot.id === 'lbf')!.top = { winnerOf: 'lbr1-1' };
    expect(issuesOf(kept)).toContain(
      'stages[1].slots[10]: an upper-bracket loser must drop to the lower bracket',
    );
  });

  it('decides the champion in exactly one slot of a final round', () => {
    const broken = copy(pglWallachia);
    const stage = playoffs(broken);
    stage.slots = stage.slots.filter((slot) => slot.id !== 'gf');
    expect(issuesOf(broken)).toEqual(
      expect.arrayContaining([
        'stages[1].slots: exactly one slot must decide the champion, found 2',
      ]),
    );
  });

  it('keeps single elimination free of lower brackets and resets', () => {
    const broken = copy(pglWallachia);
    const stage = playoffs(broken);
    stage.style = 'single-elimination';
    stage.bracketReset = true;
    const issues = issuesOf(broken);
    expect(issues).toContain(
      'stages[1].rounds[3].side: a single-elimination bracket has no lower bracket',
    );
    expect(issues).toContain(
      'stages[1].bracketReset: only a double-elimination grand final can be reset',
    );
  });
});

describe('validateFormat: Swiss', () => {
  it('needs bucket sizes that match the records', () => {
    const broken = copy(pglWallachia);
    swiss(broken).buckets[0]!.size = 3;
    expect(issuesOf(broken)).toEqual(
      expect.arrayContaining([
        'stages[0].buckets[0].size: expected 2 teams for 3-0',
        'stages[0].buckets: bucket sizes add up to 17, the stage has 16 teams',
      ]),
    );
  });

  it('puts every final record in exactly one bucket', () => {
    const broken = copy(pglWallachia);
    const stage = swiss(broken);
    stage.buckets[1]!.records = ['3-1'];
    stage.buckets[1]!.size = 3;
    stage.buckets[3]!.records = ['0-3', '4-0'];
    expect(issuesOf(broken)).toEqual(
      expect.arrayContaining([
        'stages[0].buckets: 3-2 must be in exactly one bucket, found 0',
        'stages[0].buckets[3].records: no team can finish on 4-0',
      ]),
    );
  });

  it('marks who advances consistently with the records', () => {
    const broken = copy(pglWallachia);
    swiss(broken).buckets[3]!.advances = true;
    expect(issuesOf(broken)).toContain('stages[0].buckets[3].advances: these teams are eliminated');
  });

  it('splits elimination-round records into "won" and "lost" buckets', () => {
    const broken = copy(theInternational);
    const stage = swiss(broken);
    delete stage.buckets[1]!.eliminationRound;
    expect(issuesOf(broken)).toEqual(
      expect.arrayContaining([
        'stages[0].buckets[1].records: 3-2 plays the elimination round, so the bucket must say "won" or "lost"',
        'stages[0].buckets: 3-2/won must be in exactly one bucket, found 0',
      ]),
    );
  });

  it('refuses record groups that cannot split evenly', () => {
    expect(
      swissRecordDistribution({ teams: 12, winsToFinish: 3, lossesToFinish: 3, rounds: 5 }),
    ).toBeNull();
    const broken = copy(pglWallachia);
    swiss(broken).teams = 12;
    expect(issuesOf(broken)).toContain(
      'stages[0].teams: some record group has an odd number of teams, so bucket sizes are not fixed',
    );
  });
});

describe('validateFormat: rounds', () => {
  it('predicts a bracket in the Bracket round and a group stage in the Groups round', () => {
    const broken = copy(pglWallachia);
    broken.rounds = {
      groups: { stage: 'playoffs', lockMinutesBefore: 5 },
      bracket: { stage: 'group-stage', lockMinutesBefore: 5 },
    };
    expect(issuesOf(broken)).toEqual(
      expect.arrayContaining([
        'rounds.bracket.stage: the Bracket round predicts a bracket',
        'rounds.groups.stage: the Groups round predicts a Swiss, GSL or round-robin stage',
      ]),
    );
  });

  it('asks for "not-predicted" on stages no round predicts', () => {
    const broken = copy(pglWallachia);
    delete broken.rounds.groups;
    expect(issuesOf(broken)).toEqual([
      'stages[0].kind: no round predicts this stage; describe it as "not-predicted"',
    ]);
  });

  it('accepts a round-robin group stage and scores it by the rules', () => {
    const roundRobin = copy(pglWallachia);
    roundRobin.stages[0] = {
      id: 'group-stage',
      name: 'Group stage',
      kind: 'round-robin',
      groups: 2,
      teamsPerGroup: 6,
      advancePerGroup: 4,
      bestOf: 2,
      points: { perQualifier: 10, groupWinner: 10 },
    };
    expect(validateFormat(roundRobin).ok).toBe(true);
    expect(maxBasePoints(roundRobin.stages[0])).toBe(2 * (4 * 10 + 10));
    expect(pickCount(roundRobin.stages[0])).toBe(10);

    const noOneOut = copy(roundRobin);
    noOneOut.stages[0] = { ...roundRobin.stages[0], advancePerGroup: 6 };
    expect(issuesOf(noOneOut)).toEqual(['stages[0].advancePerGroup: someone has to be eliminated']);
  });
});
