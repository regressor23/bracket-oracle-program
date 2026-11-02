import { describe, expect, it } from 'vitest';
import { singleElimination6 } from './brackets.js';
import {
  bracketOutcome,
  gslGroupOutcome,
  roundRobinGroupOutcome,
  swissOutcome,
  type SeriesResult,
} from './outcomes.js';
import type { BracketStage, GslStage, RoundRobinStage, SwissStage } from './schema.js';
import { cs2Major, pglWallachia, theInternational } from './templates.js';

const teams = (n: number, prefix = 'T') => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
const win = (winner: string, loser: string, bestOf = 3, lost = 0): SeriesResult => ({
  team1: winner,
  team2: loser,
  score1: bestOf === 2 ? 2 : Math.ceil(bestOf / 2),
  score2: lost,
});
const strength = (team: string) => Number(team.replace(/\D/g, ''));

const deBracket = pglWallachia.stages[1] as BracketStage;
const swiss3 = cs2Major.stages[2] as SwissStage;
const tiSwiss = theInternational.stages[0] as SwissStage;

/** Plays a bracket where the lower team number always wins 2-0 (3-1 in a Bo5). */
function playBracket(stage: BracketStage, positions: string[]) {
  const series: Record<string, SeriesResult> = {};
  for (let pass = 0; pass < stage.slots.length; pass += 1) {
    const outcome = bracketOutcome(stage, { positions, series });
    for (const slot of outcome.slots) {
      if (slot.winner !== null || slot.top === null || slot.bottom === null) continue;
      const bestOf = stage.rounds.find((r) => r.id === slot.round)!.bestOf;
      const [w, l] =
        strength(slot.top) < strength(slot.bottom)
          ? [slot.top, slot.bottom]
          : [slot.bottom, slot.top];
      series[slot.id] = win(w, l, bestOf, bestOf === 5 ? 1 : 0);
    }
  }
  return series;
}

describe('bracketOutcome', () => {
  const positions = teams(8);

  it('decides every slot of a double-elimination bracket and places all eight teams', () => {
    const series = playBracket(deBracket, positions);
    const outcome = bracketOutcome(deBracket, { positions, series });
    expect(outcome.issues).toEqual([]);
    expect(outcome.complete).toBe(true);
    expect(outcome.champion).toBe('T1');
    expect(outcome.slots.find((s) => s.id === 'gf')).toMatchObject({
      score: [3, 1],
      loser: expect.any(String),
    });
    const places = Object.fromEntries(outcome.placements.map((p) => [p.team, `${p.from}-${p.to}`]));
    expect(Object.keys(places)).toHaveLength(8);
    expect(places.T1).toBe('1-1');
    expect(outcome.placements.map((p) => `${p.from}-${p.to}`)).toEqual([
      '1-1',
      '2-2',
      '3-3',
      '4-4',
      '5-6',
      '5-6',
      '7-8',
      '7-8',
    ]);
  });

  it('leaves later slots open while results are missing', () => {
    const series = { 'ubqf-1': win('T1', 'T2'), 'ubqf-2': win('T4', 'T3', 3, 1) };
    const outcome = bracketOutcome(deBracket, { positions, series });
    expect(outcome.issues).toEqual([]);
    expect(outcome.complete).toBe(false);
    expect(outcome.slots.find((s) => s.id === 'ubsf-1')).toMatchObject({
      top: 'T1',
      bottom: 'T4',
      winner: null,
    });
    expect(outcome.slots.find((s) => s.id === 'lbr1-1')).toMatchObject({ top: 'T2', bottom: 'T3' });
    expect(outcome.champion).toBeNull();
  });

  it('reports a result for the wrong teams, a score that does not finish the series and unknown slots', () => {
    const outcome = bracketOutcome(deBracket, {
      positions,
      series: {
        'ubqf-1': win('T1', 'T3'),
        'ubqf-2': { team1: 'T3', team2: 'T4', score1: 1, score2: 1 },
        'ubqf-3': { team1: 'T5', team2: 'T6', score1: 1, score2: 0 },
        'ubqf-9': win('T7', 'T8'),
      },
    });
    expect(outcome.issues.map((i) => i.at)).toEqual(['ubqf-9', 'ubqf-1', 'ubqf-2', 'ubqf-3']);
    expect(outcome.slots.slice(0, 3).every((s) => s.winner === null)).toBe(true);
  });

  it('takes the winner of a forfeit from the result', () => {
    const outcome = bracketOutcome(deBracket, {
      positions,
      series: {
        'ubqf-4': { team1: 'T7', team2: 'T8', score1: 0, score2: 0, winner: 'T8', forfeit: true },
      },
    });
    expect(outcome.issues).toEqual([]);
    expect(outcome.slots.find((s) => s.id === 'ubqf-4')).toMatchObject({
      winner: 'T8',
      forfeit: true,
      score: [0, 0],
    });
  });

  it('decides a grand final with a bracket reset by the deciding series', () => {
    const stage: BracketStage = { ...deBracket, bracketReset: true };
    const series: Record<string, SeriesResult | SeriesResult[]> = playBracket(deBracket, positions);
    const gf = series.gf as SeriesResult;
    const [upper, lower] = [gf.team1, gf.team2];

    // The lower-bracket finalist wins the first final: the reset is still to come.
    series.gf = [win(lower, upper, 5, 2)];
    expect(bracketOutcome(stage, { positions, series }).champion).toBeNull();

    series.gf = [win(lower, upper, 5, 2), win(upper, lower, 5, 0)];
    const outcome = bracketOutcome(stage, { positions, series });
    expect(outcome.issues).toEqual([]);
    expect(outcome.champion).toBe(upper);
    expect(outcome.slots.at(-1)!.score).toEqual([3, 0]);

    series.gf = [win(upper, lower, 5), win(lower, upper, 5)];
    expect(bracketOutcome(stage, { positions, series }).issues[0]!.message).toMatch(
      /reset series after/,
    );
  });

  it('lets seeded teams enter later in a six-team bracket with two byes', () => {
    const stage = singleElimination6({
      id: 'playoffs',
      name: 'Playoffs',
      rounds: {
        qf: { name: 'Quarterfinals', bestOf: 3 },
        sf: { name: 'Semifinals', bestOf: 3 },
        final: { name: 'Grand final', bestOf: 5 },
      },
    });
    const six = teams(6);
    const series = playBracket(stage, six);
    const outcome = bracketOutcome(stage, { positions: six, series });
    expect(outcome.issues).toEqual([]);
    expect(outcome.slots.find((s) => s.id === 'sf-1')).toMatchObject({ top: 'T1', bottom: 'T4' });
    expect(outcome.placements.map((p) => [p.team, p.from, p.to])).toEqual([
      ['T1', 1, 1],
      ['T2', 2, 2],
      ['T4', 3, 4],
      ['T3', 3, 4],
      ['T5', 5, 6],
      ['T6', 5, 6],
    ]);
  });
});

/** Plays a Swiss stage where the lower team number always wins; pairs teams with equal records. */
function playSwiss(stage: SwissStage, names: string[]) {
  const record = new Map(names.map((t) => [t, { w: 0, l: 0 }]));
  const done = (t: string) => {
    const r = record.get(t)!;
    return r.w === stage.winsToFinish || r.l === stage.lossesToFinish || r.w + r.l === stage.rounds;
  };
  const rounds: SeriesResult[][] = [];
  for (let round = 0; round < stage.rounds; round += 1) {
    const active = names.filter((t) => !done(t));
    if (active.length === 0) break;
    const groups = new Map<string, string[]>();
    for (const t of active) {
      const r = record.get(t)!;
      const key = `${r.w}-${r.l}`;
      groups.set(key, [...(groups.get(key) ?? []), t]);
    }
    const series: SeriesResult[] = [];
    for (const group of groups.values()) {
      for (let i = 0; i < group.length; i += 2) {
        const [a, b] = [group[i]!, group[i + 1]!];
        const ra = record.get(a)!;
        const rb = record.get(b)!;
        const decisive = [ra, rb].some(
          (r) => r.w + 1 === stage.winsToFinish || r.l + 1 === stage.lossesToFinish,
        );
        series.push(win(a, b, decisive ? stage.bestOf.decisive : stage.bestOf.other));
        ra.w += 1;
        rb.l += 1;
      }
    }
    rounds.push(series);
  }
  return { rounds, record };
}

describe('swissOutcome', () => {
  it('puts every team of a three-win Swiss stage in its bucket', () => {
    const names = teams(16);
    const { rounds } = playSwiss(swiss3, names);
    const outcome = swissOutcome(swiss3, { teams: names, rounds });
    expect(outcome.issues).toEqual([]);
    expect(outcome.complete).toBe(true);
    const count = (bucket: string) => outcome.teams.filter((t) => t.bucket === bucket).length;
    expect([count('3-0'), count('advance'), count('eliminated'), count('0-3')]).toEqual([
      2, 6, 6, 2,
    ]);
    expect(outcome.teams.find((t) => t.team === 'T1')).toMatchObject({
      record: '3-0',
      bucket: '3-0',
      finishedInRound: 3,
    });
    expect(outcome.teams.find((t) => t.team === 'T16')).toMatchObject({
      record: '0-3',
      bucket: '0-3',
    });
  });

  it('keeps teams of the elimination round without a bucket until it is played', () => {
    const names = teams(16);
    const { rounds, record } = playSwiss(tiSwiss, names);
    const pending = swissOutcome(tiSwiss, { teams: names, rounds });
    expect(pending.issues).toEqual([]);
    expect(pending.complete).toBe(false);

    const playing = names.filter((t) =>
      ['3-2', '2-3'].includes(`${record.get(t)!.w}-${record.get(t)!.l}`),
    );
    expect(playing).toHaveLength(10);
    const eliminationRound = Array.from({ length: 5 }, (_, i) => win(playing[i]!, playing[i + 5]!));
    const outcome = swissOutcome(tiSwiss, { teams: names, rounds, eliminationRound });
    expect(outcome.issues).toEqual([]);
    expect(outcome.complete).toBe(true);
    const count = (bucket: string) => outcome.teams.filter((t) => t.bucket === bucket).length;
    expect([
      count('direct'),
      count('elimination-won'),
      count('elimination-lost'),
      count('out'),
    ]).toEqual([3, 5, 5, 3]);
  });

  it('reports a team that plays twice, plays after finishing, or a wrong series length', () => {
    const names = teams(16);
    const { rounds } = playSwiss(swiss3, names);
    const messages = (changed: SeriesResult[][]) =>
      swissOutcome(swiss3, { teams: names, rounds: changed }).issues.map((i) => i.message);

    const twice = rounds.map((r, i) => (i === 0 ? [...r, win('T1', 'T3', 1)] : r));
    expect(messages(twice)).toContain('T1 plays twice in one round');

    const afterFinish = [
      ...rounds.slice(0, 3),
      [...rounds[3]!, win('T1', 'T16', 3)],
      ...rounds.slice(4),
    ];
    expect(messages(afterFinish)).toContain('T1 already finished with 3-0');

    const wrongLength = rounds.map((r, i) =>
      i === 0 ? [{ ...r[0]!, score1: 2 }, ...r.slice(1)] : r,
    );
    expect(messages(wrongLength)[0]).toBe('2-0 does not finish a Bo1');
  });
});

describe('gslGroupOutcome', () => {
  const gsl: GslStage = {
    id: 'groups',
    name: 'Groups',
    kind: 'gsl',
    groups: 4,
    bestOf: 3,
    points: { first: 10, second: 10 },
  };
  const group = ['A1', 'A2', 'A3', 'A4'] as const;

  it('ranks a group from its five series', () => {
    const outcome = gslGroupOutcome(gsl, {
      group: 'A',
      teams: group,
      series: {
        opening1: win('A1', 'A4'),
        opening2: win('A3', 'A2', 3, 1),
        winners: win('A3', 'A1'),
        elimination: win('A2', 'A4'),
        decider: win('A1', 'A2'),
      },
    });
    expect(outcome).toMatchObject({
      first: 'A3',
      second: 'A1',
      third: 'A2',
      fourth: 'A4',
      complete: true,
      issues: [],
    });
  });

  it('rejects a winners match between the wrong teams', () => {
    const outcome = gslGroupOutcome(gsl, {
      group: 'A',
      teams: group,
      series: { opening1: win('A1', 'A4'), opening2: win('A3', 'A2'), winners: win('A1', 'A2') },
    });
    expect(outcome.first).toBeNull();
    expect(outcome.issues[0]!.message).toBe('result is A1 vs A2, expected A1 vs A3');
  });
});

describe('roundRobinGroupOutcome', () => {
  const rr: RoundRobinStage = {
    id: 'groups',
    name: 'Groups',
    kind: 'round-robin',
    groups: 2,
    teamsPerGroup: 4,
    advancePerGroup: 2,
    bestOf: 2,
    points: { perQualifier: 10, groupWinner: 10 },
  };
  const draw = (a: string, b: string): SeriesResult => ({
    team1: a,
    team2: b,
    score1: 1,
    score2: 1,
  });
  const g = ['B1', 'B2', 'B3', 'B4'];

  it('builds the table with Bo2 draws and names qualifiers and the winner', () => {
    const outcome = roundRobinGroupOutcome(rr, {
      group: 'B',
      teams: g,
      series: [
        win('B1', 'B2', 2),
        draw('B1', 'B3'),
        win('B1', 'B4', 2),
        draw('B2', 'B3'),
        win('B2', 'B4', 2),
        win('B3', 'B4', 2),
      ],
    });
    expect(outcome.issues).toEqual([]);
    expect(
      outcome.table.map((r) => [
        r.team,
        r.wins,
        r.draws,
        r.losses,
        r.mapDifference,
        r.points,
        r.rank,
      ]),
    ).toEqual([
      ['B1', 2, 1, 0, 4, 7, 1],
      ['B3', 1, 2, 0, 2, 5, 2],
      ['B2', 1, 1, 1, 0, 4, 3],
      ['B4', 0, 0, 3, -6, 0, 4],
    ]);
    expect(outcome).toMatchObject({
      qualifiers: ['B1', 'B3'],
      winner: 'B1',
      needsOrder: false,
      complete: true,
    });
  });

  it('asks for the order when a tie crosses the cut, and takes a tiebreaker or the admin order', () => {
    const series = [
      draw('B1', 'B2'),
      win('B1', 'B3', 2),
      win('B4', 'B1', 2),
      win('B2', 'B3', 2),
      draw('B2', 'B4'),
      win('B3', 'B4', 2),
    ];
    const tied = roundRobinGroupOutcome(rr, { group: 'B', teams: g, series });
    expect(tied.table.map((r) => [r.team, r.points, r.rank])).toEqual([
      ['B2', 5, 1],
      ['B1', 4, 2],
      ['B4', 4, 2],
      ['B3', 3, 4],
    ]);
    expect(tied).toMatchObject({
      qualifiers: null,
      winner: 'B2',
      needsOrder: true,
      complete: false,
    });

    const broken = roundRobinGroupOutcome(rr, {
      group: 'B',
      teams: g,
      series,
      tiebreakers: [win('B4', 'B1', 1)],
    });
    expect(broken).toMatchObject({ qualifiers: ['B2', 'B4'], needsOrder: false, complete: true });

    const ordered = roundRobinGroupOutcome(rr, {
      group: 'B',
      teams: g,
      series,
      order: ['B2', 'B1', 'B4', 'B3'],
    });
    expect(ordered).toMatchObject({
      qualifiers: ['B2', 'B1'],
      winner: 'B2',
      needsOrder: false,
      complete: true,
    });
  });

  it('waits until every pair has played', () => {
    const outcome = roundRobinGroupOutcome(rr, {
      group: 'B',
      teams: g,
      series: [win('B1', 'B2', 2)],
    });
    expect(outcome).toMatchObject({
      qualifiers: null,
      winner: null,
      complete: false,
      needsOrder: false,
    });
  });
});
