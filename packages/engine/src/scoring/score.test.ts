import { describe, expect, it } from 'vitest';
import {
  bracketOutcome,
  gslGroupOutcome,
  roundRobinGroupOutcome,
  type SeriesResult,
} from '../formats/outcomes.js';
import { roundStage } from '../formats/points.js';
import type { BracketStage, GslStage, RoundRobinStage, Stage } from '../formats/schema.js';
import { blastSlam, cs2Major, theInternational } from '../formats/templates.js';
import type { BracketPick, Picks, Prediction } from '../predictions/schema.js';
import {
  formatPoints,
  isUnderdog,
  pickShares,
  scorePrediction,
  type ActualOutcome,
  type ScoringSettings,
} from './score.js';

/**
 * The examples from the rules (rules, «Скоринг і тай-брейк»), one per row. Points are in
 * tenths: 100 is 10 points.
 */

const TEAMS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const tiMain = roundStage(theInternational, 'bracket') as BracketStage;
const cs2Playoffs = roundStage(cs2Major, 'bracket') as BracketStage;

function doc(picks: Picks): Prediction {
  return {
    format: 1,
    tournament: 't',
    contest: 'c',
    round: picks.kind === 'bracket' ? 'bracket' : 'groups',
    template: { id: 'x', version: 1 },
    revision: 1,
    picks,
    tiebreak: null,
  };
}

const series = (team1: string, team2: string, score1: number, score2: number): SeriesResult => ({
  team1,
  team2,
  score1,
  score2,
});

/**
 * Official TI-shaped results: the top team wins every series 2-1 (3-1 in the final), so the
 * winners are a, c, e, g in the first round and so on.
 */
function tiResults(overrides: Record<string, SeriesResult> = {}): ActualOutcome {
  const s: Record<string, SeriesResult> = {
    'ubqf-1': series('a', 'b', 2, 1),
    'ubqf-2': series('c', 'd', 2, 1),
    'ubqf-3': series('e', 'f', 2, 1),
    'ubqf-4': series('g', 'h', 2, 1),
    'ubsf-1': series('a', 'c', 2, 1),
    'ubsf-2': series('e', 'g', 2, 1),
    'lbr1-1': series('b', 'd', 2, 1),
    'lbr1-2': series('f', 'h', 2, 1),
    'lbqf-1': series('g', 'b', 2, 1),
    'lbqf-2': series('c', 'f', 2, 1),
    ubf: series('a', 'e', 2, 1),
    lbsf: series('g', 'c', 2, 1),
    lbf: series('e', 'g', 2, 1),
    gf: series('a', 'e', 3, 1),
    ...overrides,
  };
  return { kind: 'bracket', outcome: bracketOutcome(tiMain, { positions: TEAMS, series: s }) };
}

/** The winner of every slot in `tiResults`, so a prediction can pick them. */
const TI_WINNERS: Record<string, string> = {
  'ubqf-1': 'a',
  'ubqf-2': 'c',
  'ubqf-3': 'e',
  'ubqf-4': 'g',
  'ubsf-1': 'a',
  'ubsf-2': 'e',
  'lbr1-1': 'b',
  'lbr1-2': 'f',
  'lbqf-1': 'g',
  'lbqf-2': 'c',
  ubf: 'a',
  lbsf: 'g',
  lbf: 'e',
  gf: 'a',
};

function bracketPicks(picks: Record<string, BracketPick | string>): Picks {
  return {
    kind: 'bracket',
    slots: Object.fromEntries(
      Object.entries(picks).map(([slot, p]) => [slot, typeof p === 'string' ? { winner: p } : p]),
    ),
  };
}

const score = (stage: Stage, picks: Picks, actual: ActualOutcome, settings?: ScoringSettings) =>
  scorePrediction(stage, doc(picks), actual, settings);

describe('bracket points by round', () => {
  const all = score(tiMain, bracketPicks(TI_WINNERS), tiResults());

  it.each([
    // Double elimination, 8 teams: upper 10 / 15 / 20, lower 5 / 10 / 15 / 20, grand final 40.
    ['ubqf-1', 100],
    ['ubsf-1', 150],
    ['ubf', 200],
    ['lbr1-1', 50],
    ['lbqf-1', 100],
    ['lbsf', 150],
    ['lbf', 200],
    ['gf', 400],
  ])('double elimination: a correct %s earns %i', (slot, points) => {
    expect(all.picks.find((p) => p.path === `picks.slots.${slot}`)).toMatchObject({
      result: 'correct',
      points,
      bonus: 0,
    });
  });

  it('a perfect bracket earns the template maximum, 195', () => {
    expect(all).toMatchObject({ points: 1950, correct: 14, exactScores: 0, pending: 0 });
  });

  it.each([
    // Single elimination: points double each round and the final is 40.
    ['qf-1', 100],
    ['sf-1', 200],
    ['final', 400],
  ])('single elimination: a correct %s earns %i', (slot, points) => {
    const results = {
      positions: TEAMS,
      series: {
        'qf-1': series('a', 'b', 2, 0),
        'qf-2': series('c', 'd', 2, 0),
        'sf-1': series('a', 'c', 2, 0),
        'qf-3': series('e', 'f', 2, 0),
        'qf-4': series('g', 'h', 2, 0),
        'sf-2': series('e', 'g', 2, 0),
        final: series('a', 'e', 3, 0),
      },
    };
    const actual: ActualOutcome = {
      kind: 'bracket',
      outcome: bracketOutcome(cs2Playoffs, results),
    };
    const picks = bracketPicks({
      'qf-1': 'a',
      'qf-2': 'c',
      'qf-3': 'e',
      'qf-4': 'g',
      'sf-1': 'a',
      'sf-2': 'e',
      final: 'a',
    });
    const result = score(cs2Playoffs, picks, actual);
    expect(result.picks.find((p) => p.path === `picks.slots.${slot}`)?.points).toBe(points);
  });
});

describe('exact-score bonus', () => {
  it.each([
    ['Bo3, exact score', 'ubqf-1', { winner: 'a', score: [2, 1] }, 100, 50],
    ['Bo3, wrong score', 'ubqf-1', { winner: 'a', score: [2, 0] }, 100, 0],
    ['Bo5, exact score', 'gf', { winner: 'a', score: [3, 1] }, 400, 100],
    ['wrong winner, no bonus', 'ubqf-1', { winner: 'b', score: [2, 1] }, 0, 0],
  ] as const)('%s', (_, slot, pick, points, bonus) => {
    const picks = bracketPicks({ ...TI_WINNERS, [slot]: { ...pick, score: [...pick.score] } });
    const result = score(tiMain, picks, tiResults());
    expect(result.picks.find((p) => p.path === `picks.slots.${slot}`)).toMatchObject({
      points,
      bonus,
    });
  });

  it('gives no bonus for a forfeit', () => {
    const forfeit = { ...series('a', 'b', 2, 1), winner: 'a', forfeit: true };
    const result = score(
      tiMain,
      bracketPicks({ 'ubqf-1': { winner: 'a', score: [2, 1] } }),
      tiResults({ 'ubqf-1': forfeit }),
    );
    expect(result.picks[0]).toMatchObject({ result: 'correct', points: 100, bonus: 0 });
  });

  it('gives no bonus for a Bo1, even if a score is in the document', () => {
    const bo1: BracketStage = {
      ...cs2Playoffs,
      rounds: cs2Playoffs.rounds.map((r) => ({ ...r, bestOf: 1 as const })),
    };
    const actual: ActualOutcome = {
      kind: 'bracket',
      outcome: bracketOutcome(bo1, {
        positions: TEAMS,
        series: { 'qf-1': series('a', 'b', 1, 0) },
      }),
    };
    const result = score(bo1, bracketPicks({ 'qf-1': { winner: 'a', score: [2, 0] } }), actual);
    expect(result.picks[0]).toMatchObject({ points: 100, bonus: 0 });
  });
});

describe('underdog ×1.5', () => {
  // Eight predictions send b and d to the first lower round; only one backs d there.
  const feeders = { 'ubqf-1': 'a', 'ubqf-2': 'c' };
  const others = Array.from({ length: 7 }, () => doc(bracketPicks({ ...feeders, 'lbr1-1': 'b' })));
  const lone = doc(bracketPicks({ ...feeders, 'lbr1-1': 'd' }));
  const lbr1 = (result: ReturnType<typeof scorePrediction>) =>
    result.picks.find((p) => p.path === 'picks.slots.lbr1-1');
  const dWins = tiResults({ 'lbr1-1': series('b', 'd', 0, 2), 'lbqf-1': series('g', 'd', 2, 0) });

  it('multiplies the base points of a winner picked by fewer than 25% of predictions', () => {
    const shares = pickShares([...others, lone]);
    expect(isUnderdog(shares, 'lbr1-1', 'd')).toBe(true);
    const result = scorePrediction(tiMain, lone, dWins, { underdog: shares });
    // 5 points × 1.5 = 7.5, after 10 + 10 for the two upper quarterfinals.
    expect(lbr1(result)).toMatchObject({ points: 75, underdog: true });
    expect(formatPoints(result.points)).toBe('27.5');
  });

  it('does not apply at exactly 25%', () => {
    const shares = pickShares([...others.slice(0, 6), lone, lone]);
    expect(isUnderdog(shares, 'lbr1-1', 'd')).toBe(false);
    expect(lbr1(scorePrediction(tiMain, lone, dWins, { underdog: shares }))?.points).toBe(50);
  });

  it('is off unless the round turns it on', () => {
    expect(lbr1(scorePrediction(tiMain, lone, dWins))).toMatchObject({
      points: 50,
      underdog: false,
    });
  });

  it('counts picks on a replaced team as picks on its replacement', () => {
    // Every prediction picked the team that was later replaced by a: a is no underdog.
    const all = Array.from({ length: 8 }, () => doc(bracketPicks({ 'ubqf-1': 'old' })));
    const settings = { underdog: pickShares(all), replacements: { old: 'a' } };
    expect(isUnderdog(settings.underdog, 'ubqf-1', 'a', settings.replacements)).toBe(false);
    expect(scorePrediction(tiMain, all[0]!, tiResults(), settings).picks[0]).toMatchObject({
      points: 100,
      underdog: false,
    });
  });

  it('does not multiply the exact-score bonus', () => {
    const shares = pickShares([...others, lone]);
    const withScore = doc(bracketPicks({ ...feeders, 'lbr1-1': { winner: 'd', score: [2, 0] } }));
    const result = scorePrediction(tiMain, withScore, dWins, { underdog: shares });
    expect(lbr1(result)).toMatchObject({ points: 75, bonus: 50 });
  });
});

describe('picks that cannot score', () => {
  it('gives 0 for later picks on a team that was knocked out', () => {
    // b loses ubqf-1, so the later pick of b to win the upper semifinal is simply wrong.
    const picks = bracketPicks({ 'ubqf-1': 'b', 'ubqf-2': 'c', 'ubsf-1': 'b' });
    expect(
      score(tiMain, picks, tiResults()).picks.map((p) => [p.path, p.result, p.points]),
    ).toEqual([
      ['picks.slots.ubqf-1', 'wrong', 0],
      ['picks.slots.ubqf-2', 'correct', 100],
      ['picks.slots.ubsf-1', 'wrong', 0],
    ]);
  });

  it("gives 0 for a pick that does not follow from the player's own earlier picks", () => {
    // The player sends d through ubqf-2 but still picks c to win the semifinal; c does win it.
    const result = score(
      tiMain,
      bracketPicks({ 'ubqf-1': 'a', 'ubqf-2': 'd', 'ubsf-1': 'c' }),
      tiResults({ 'ubsf-1': series('a', 'c', 1, 2) }),
    );
    expect(result.picks.find((p) => p.path === 'picks.slots.ubsf-1')).toMatchObject({
      result: 'stale',
      points: 0,
    });
  });

  it('counts a pick on a team the earlier picks brought there, with the other side unknown', () => {
    // ubqf-2 is left empty: a still reaches the semifinal, so backing a there counts.
    const result = score(tiMain, bracketPicks({ 'ubqf-1': 'a', 'ubsf-1': 'a' }), tiResults());
    expect(result.picks.map((p) => [p.path, p.result, p.points])).toEqual([
      ['picks.slots.ubqf-1', 'correct', 100],
      ['picks.slots.ubsf-1', 'correct', 150],
    ]);
  });

  it('keeps later picks on other teams after a stale pick', () => {
    // ubsf-1 is stale (c was sent to the lower bracket), but f reached lbqf-2 through the
    // player's own lbr1-2 pick, so the lbqf-2 pick on f still counts.
    const picks = bracketPicks({
      'ubqf-1': 'a',
      'ubqf-2': 'd',
      'ubqf-3': 'e',
      'ubqf-4': 'g',
      'ubsf-1': 'c',
      'lbr1-2': 'f',
      'lbqf-2': 'f',
    });
    const actual = tiResults({
      'ubsf-1': series('a', 'c', 1, 2),
      'lbqf-2': series('a', 'f', 0, 2),
    });
    const result = score(tiMain, picks, actual);
    expect(result.picks.find((p) => p.path === 'picks.slots.ubsf-1')?.result).toBe('stale');
    expect(result.picks.find((p) => p.path === 'picks.slots.lbqf-2')).toMatchObject({
      result: 'correct',
      points: 100,
    });
  });

  it('scores a slot by its winner, however the team got there', () => {
    // The player expected a vs c in ubsf-1; it was a vs d, and a won: the pick counts.
    const actual = tiResults({
      'ubqf-2': series('c', 'd', 0, 2),
      'ubsf-1': series('a', 'd', 2, 0),
    });
    const picks = bracketPicks({ 'ubqf-1': 'a', 'ubqf-2': 'c', 'ubsf-1': 'a' });
    expect(score(tiMain, picks, actual).picks.map((p) => p.points)).toEqual([100, 0, 150]);
  });

  it('leaves undecided series pending and empty slots out', () => {
    const outcome = bracketOutcome(tiMain, {
      positions: TEAMS,
      series: { 'ubqf-1': series('a', 'b', 2, 0) },
    });
    const picks = bracketPicks({ 'ubqf-1': 'a', 'ubqf-2': 'c', 'ubsf-1': 'a' });
    const result = score(tiMain, picks, { kind: 'bracket', outcome });
    expect(result).toMatchObject({ points: 100, correct: 1, pending: 2 });
    expect(result.picks).toHaveLength(3);
  });

  it('gives 0 for a pick made before the picks that decide who plays the slot', () => {
    // Nobody is sent to the final yet in this bracket, so backing a to win it does not count.
    const result = score(tiMain, bracketPicks({ 'ubqf-1': 'a', gf: 'a' }), tiResults());
    expect(result.picks.map((p) => [p.path, p.result])).toEqual([
      ['picks.slots.ubqf-1', 'correct'],
      ['picks.slots.gf', 'stale'],
    ]);
  });

  it('moves picks on a replaced team to its replacement', () => {
    const picks = bracketPicks({ 'ubqf-1': 'old' });
    const result = score(tiMain, picks, tiResults(), { replacements: { old: 'a' } });
    expect(result.points).toBe(100);
  });
});

describe('group stages', () => {
  it('Swiss buckets are strict: 15 for the 3-0 and 0-3 buckets, 10 for others, 0 next door', () => {
    const swiss = roundStage(cs2Major, 'groups')!;
    const teams = ['t1', 't2', 't3', 't4'];
    const outcome = {
      teams: teams.map((team, i) => ({
        team,
        wins: 0,
        losses: 0,
        record: '',
        finishedInRound: 5,
        eliminationRound: null,
        bucket: ['3-0', 'advance', '0-3', 'eliminated'][i]!,
      })),
      complete: true,
      issues: [],
    };
    const picks: Picks = {
      kind: 'swiss',
      buckets: { t1: '3-0', t2: 'advance', t3: 'eliminated', t4: 'eliminated', t9: 'advance' },
    };
    const result = score(swiss, picks, { kind: 'swiss', outcome });
    expect(result.picks.map((p) => [p.path, p.result, p.points])).toEqual([
      ['picks.buckets.t1', 'correct', 150],
      ['picks.buckets.t2', 'correct', 100],
      ['picks.buckets.t3', 'wrong', 0],
      ['picks.buckets.t4', 'correct', 100],
      ['picks.buckets.t9', 'stale', 0],
    ]);
  });

  it('leaves picks on a group without results pending', () => {
    const gsl = roundStage(blastSlam, 'groups') as GslStage;
    const picks: Picks = { kind: 'gsl', groups: { B: { first: 'e', second: 'f' } } };
    const result = score(gsl, picks, { kind: 'gsl', groups: [] });
    expect(result).toMatchObject({ points: 0, pending: 2 });
  });

  it('GSL: 10 for the first place and 10 for the second', () => {
    const gsl = roundStage(blastSlam, 'groups') as GslStage;
    const group = gslGroupOutcome(gsl, {
      group: 'A',
      teams: ['a', 'b', 'c', 'd'],
      series: {
        opening1: series('a', 'b', 2, 0),
        opening2: series('c', 'd', 2, 0),
        winners: series('a', 'c', 2, 0),
        elimination: series('b', 'd', 2, 0),
        decider: series('c', 'b', 2, 0),
      },
    });
    const right: Picks = { kind: 'gsl', groups: { A: { first: 'a', second: 'c' } } };
    const swapped: Picks = { kind: 'gsl', groups: { A: { first: 'c', second: 'a' } } };
    expect(score(gsl, right, { kind: 'gsl', groups: [group] }).points).toBe(200);
    expect(score(gsl, swapped, { kind: 'gsl', groups: [group] }).points).toBe(0);
  });

  it('round-robin: 10 for each team that advances, plus 10 for the group winner', () => {
    const stage: RoundRobinStage = {
      id: 'groups',
      name: 'Groups',
      kind: 'round-robin',
      groups: 1,
      teamsPerGroup: 4,
      advancePerGroup: 2,
      bestOf: 3,
      points: { perQualifier: 10, groupWinner: 10 },
    };
    const group = roundRobinGroupOutcome(stage, {
      group: 'A',
      teams: ['a', 'b', 'c', 'd'],
      series: [
        series('a', 'b', 2, 0),
        series('a', 'c', 2, 0),
        series('a', 'd', 2, 0),
        series('b', 'c', 2, 0),
        series('b', 'd', 2, 0),
        series('c', 'd', 2, 0),
      ],
    });
    const picks: Picks = {
      kind: 'round-robin',
      groups: { A: { qualifiers: ['b', 'c'], winner: 'b' } },
    };
    const result = score(stage, picks, { kind: 'round-robin', groups: [group] });
    // b advances (10), c does not (0), b is not the winner (0).
    expect(result.picks.map((p) => p.points)).toEqual([100, 0, 0]);
    const perfect: Picks = {
      kind: 'round-robin',
      groups: { A: { qualifiers: ['a', 'b'], winner: 'a' } },
    };
    expect(score(stage, perfect, { kind: 'round-robin', groups: [group] }).points).toBe(300);
  });
});

it('formats tenths with one decimal', () => {
  expect([0, 5, 75, 1950, 2700].map(formatPoints)).toEqual(['0.0', '0.5', '7.5', '195.0', '270.0']);
});
