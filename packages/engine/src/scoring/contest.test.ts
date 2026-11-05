import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BracketResults, SwissResults } from '../formats/outcomes.js';
import { theInternational } from '../formats/templates.js';
import type { Prediction } from '../predictions/schema.js';
import { formatPoints } from './score.js';
import { mapsPlayed, scoreContest } from './contest.js';
import { roundStage } from '../formats/points.js';

/**
 * Sample predictions scored against the official results of The International 2026 (the replay
 * fixture from issue #19). The expected totals were computed separately, by hand and with a short
 * Python script that does not use the engine.
 */

const ti = JSON.parse(
  readFileSync(new URL('../../fixtures/replays/ti-2026.json', import.meta.url), 'utf8'),
) as {
  stages: {
    'main-event': { results: BracketResults };
    'group-stage': { results: SwissResults; expected: { buckets: Record<string, string[]> } };
  };
};

type Slots = Record<string, [string, [number, number]?]>;

function bracket(
  id: string,
  slots: Slots,
  maps: number | null,
): { id: string; prediction: Prediction } {
  return {
    id,
    prediction: {
      format: 1,
      tournament: 'ti-2026',
      contest: 'ti-2026-bracket',
      round: 'bracket',
      template: { id: 'ti', version: 1 },
      revision: 1,
      picks: {
        kind: 'bracket',
        slots: Object.fromEntries(
          Object.entries(slots).map(([slot, [winner, score]]) => [
            slot,
            score ? { winner, score } : { winner },
          ]),
        ),
      },
      tiebreak: maps === null ? null : { maps },
    },
  };
}

/** Every official winner and score: 195 base points and 75 for exact scores. */
const PERFECT: Slots = {
  'ubqf-1': ['team-spirit', [2, 0]],
  'ubqf-2': ['team-vision', [2, 1]],
  'ubqf-3': ['team-yandex', [2, 0]],
  'ubqf-4': ['nigma-galaxy', [2, 1]],
  'ubsf-1': ['team-vision', [2, 1]],
  'ubsf-2': ['team-yandex', [2, 1]],
  'lbr1-1': ['boomboys', [2, 1]],
  'lbr1-2': ['team-liquid', [2, 1]],
  'lbqf-1': ['boomboys', [2, 1]],
  'lbqf-2': ['team-spirit', [2, 0]],
  ubf: ['team-vision', [2, 1]],
  lbsf: ['team-spirit', [2, 0]],
  lbf: ['team-spirit', [2, 0]],
  gf: ['team-spirit', [3, 2]],
};

/**
 * The higher position wins every series. Right: ubqf-2 (10, with the exact 2-1, +5) and ubqf-4
 * (10; 2-0 was wrong). Everything else misses: 25 points.
 */
const SEEDS: Slots = {
  'ubqf-1': ['iron-wing'],
  'ubqf-2': ['team-vision', [2, 1]],
  'ubqf-3': ['team-liquid'],
  'ubqf-4': ['nigma-galaxy', [2, 0]],
  'ubsf-1': ['iron-wing'],
  'ubsf-2': ['team-liquid'],
  'lbr1-1': ['team-spirit'],
  'lbr1-2': ['team-yandex'],
  'lbqf-1': ['nigma-galaxy'],
  'lbqf-2': ['team-vision'],
  ubf: ['iron-wing'],
  lbsf: ['nigma-galaxy'],
  lbf: ['team-liquid'],
  gf: ['iron-wing'],
};

/**
 * Team Spirit through the upper bracket. Right: ubqf-1 (10 +5), ubqf-2 (10), ubqf-3 (10),
 * ubsf-2 (15 +5), lbr1-1 (5), lbqf-1 (10) and the grand final (40 +10): 120 points. The final
 * counts although this bracket had Spirit meet Yandex there: a pick is the slot.
 */
const SPIRIT: Slots = {
  'ubqf-1': ['team-spirit', [2, 0]],
  'ubqf-2': ['team-vision', [2, 0]],
  'ubqf-3': ['team-yandex'],
  'ubqf-4': ['team-falcons'],
  'ubsf-1': ['team-spirit'],
  'ubsf-2': ['team-yandex', [2, 1]],
  'lbr1-1': ['boomboys'],
  'lbr1-2': ['nigma-galaxy'],
  'lbqf-1': ['boomboys'],
  'lbqf-2': ['team-vision'],
  ubf: ['team-spirit'],
  lbsf: ['team-vision'],
  lbf: ['team-yandex'],
  gf: ['team-spirit', [3, 2]],
};

describe('The International 2026, Bracket round', () => {
  const results = ti.stages['main-event'].results;
  const contest = scoreContest({
    template: theInternational,
    round: 'bracket',
    results,
    entries: [
      bracket('seeds', SEEDS, 39),
      bracket('spirit-far', SPIRIT, 50),
      bracket('perfect', PERFECT, 39),
      bracket('spirit-close', SPIRIT, 38),
      bracket('spirit-blank', SPIRIT, null),
      bracket('spirit-close-too', SPIRIT, 40),
      { id: 'broken', prediction: { format: 1 } },
    ],
  });

  it('scores the samples to the expected totals', () => {
    const totals = Object.fromEntries(contest.entries.map((e) => [e.id, formatPoints(e.points)]));
    expect(totals).toEqual({
      perfect: '270.0',
      'spirit-close': '120.0',
      'spirit-close-too': '120.0',
      'spirit-far': '120.0',
      'spirit-blank': '120.0',
      seeds: '25.0',
      broken: '0.0',
    });
    expect(contest.entries.find((e) => e.id === 'perfect')).toMatchObject({
      correct: 14,
      exactScores: 14,
      pending: 0,
    });
  });

  it('ranks by points, then the tie-break, and shares equal places', () => {
    expect(contest).toMatchObject({ complete: true, mapsPlayed: 39, issues: [] });
    expect(contest.entries.slice(0, -1).map((e) => [e.id, e.place?.from, e.place?.to])).toEqual([
      ['perfect', 1, 1],
      // 38 and 40 maps are both one away from 39: a shared second place.
      ['spirit-close', 2, 3],
      ['spirit-close-too', 2, 3],
      ['spirit-far', 4, 4],
      ['spirit-blank', 5, 5],
      ['seeds', 6, 6],
    ]);
    // An invalid document scores nothing and takes no place, so no valid entry shares one with it.
    expect(contest.entries.at(-1)).toMatchObject({ id: 'broken', points: 0, place: null });
    expect(contest.entries.at(-1)?.issues[0]).toMatch(/^tournament: /);
  });

  it('refuses predictions for another contest when the contest is given', () => {
    const other = bracket('other', PERFECT, 39);
    other.prediction.contest = 'another-contest';
    const result = scoreContest({
      template: theInternational,
      round: 'bracket',
      contest: 'ti-2026-bracket',
      results,
      entries: [bracket('mine', SEEDS, 39), other],
    });
    expect(result.entries.map((e) => [e.id, e.points, e.place?.from ?? null])).toEqual([
      ['mine', 250, 1],
      ['other', 0, null],
    ]);
    expect(result.entries[1]?.issues).toEqual([
      'contest: the prediction is for contest another-contest, not ti-2026-bracket',
    ]);
  });

  it('counts the maps played for the tie-break', () => {
    expect(mapsPlayed(roundStage(theInternational, 'bracket')!, results)).toBe(39);
  });

  it('leaves later series pending while the round is played', () => {
    const live: BracketResults = {
      positions: results.positions,
      series: { 'ubqf-1': results.series['ubqf-1']!, 'ubqf-2': results.series['ubqf-2']! },
    };
    const partial = scoreContest({
      template: theInternational,
      round: 'bracket',
      results: live,
      entries: [bracket('perfect', PERFECT, 39)],
    });
    expect(partial).toMatchObject({ complete: false, mapsPlayed: null });
    // Both decided series are right with their exact scores: 15 + 15.
    expect(partial.entries[0]).toMatchObject({ points: 300, pending: 12 });
  });
});

describe('The International 2026, Groups round', () => {
  const official = ti.stages['group-stage'].expected.buckets;
  const truth = Object.fromEntries(
    Object.entries(official).flatMap(([bucket, teams]) => teams.map((t) => [t, bucket])),
  );

  const groups = (id: string, buckets: Record<string, string>) => ({
    id,
    prediction: {
      format: 1,
      tournament: 'ti-2026',
      contest: 'ti-2026-groups',
      round: 'groups',
      template: { id: 'ti', version: 1 },
      revision: 1,
      picks: { kind: 'swiss', buckets },
      tiebreak: null,
    },
  });

  it('scores a perfect Swiss prediction 190 and a near miss 165', () => {
    // Vision (direct, 15) and Spirit (won the elimination round, 10) swapped: 25 lost.
    const swapped = { ...truth, 'team-vision': 'elimination-won', 'team-spirit': 'direct' };
    const contest = scoreContest({
      template: theInternational,
      round: 'groups',
      results: ti.stages['group-stage'].results,
      entries: [groups('swapped', swapped), groups('perfect', truth)],
    });
    expect(contest.entries.map((e) => [e.id, formatPoints(e.points), e.place?.from])).toEqual([
      ['perfect', '190.0', 1],
      ['swapped', '165.0', 2],
    ]);
    expect(contest.complete).toBe(true);
  });
});
