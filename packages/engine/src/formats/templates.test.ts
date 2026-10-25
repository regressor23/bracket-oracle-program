import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DOUBLE_ELIMINATION_8_POINTS, SINGLE_ELIMINATION_8_POINTS } from './brackets.js';
import { formatJsonSchema } from './json-schema.js';
import { maxBasePoints, maxExactScoreBonus, pickCount, roundStage } from './points.js';
import { resolveBracket } from './resolve.js';
import type { BracketStage, FormatTemplate, SwissStage } from './schema.js';
import { FORMAT_TEMPLATES, getFormatTemplate } from './templates.js';
import { swissRecordDistribution, validateFormat } from './validate.js';

const readCommitted = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../formats/${name}`, import.meta.url), 'utf8'));

function template(id: string): FormatTemplate {
  const found = getFormatTemplate(id);
  if (!found) throw new Error(`no template ${id}`);
  return found;
}

function bracketOf(id: string): BracketStage {
  const stage = roundStage(template(id), 'bracket');
  if (stage?.kind !== 'bracket') throw new Error(`${id} has no bracket`);
  return stage;
}

function groupsOf(id: string) {
  return roundStage(template(id), 'groups');
}

/** Every slot as "top vs bottom", for comparing with the brackets on Liquipedia. */
function matchups(stage: BracketStage, positions: string[], winners: Record<string, string>) {
  const { slots, stalePicks } = resolveBracket(stage, positions, winners);
  expect(stalePicks).toEqual([]);
  return Object.fromEntries(slots.map((slot) => [slot.id, `${slot.top} vs ${slot.bottom}`]));
}

describe.each(FORMAT_TEMPLATES.map((t) => [t.id, t] as const))('%s template', (_id, format) => {
  it('passes the schema and every structural check', () => {
    expect(validateFormat(format)).toEqual({ ok: true, template: format });
  });

  it('matches the committed JSON file', () => {
    expect(readCommitted(`${format.id}.json`)).toEqual(format);
  });

  it('locks each round 5 minutes before the first match of its stage', () => {
    const rounds = Object.values(format.rounds);
    expect(rounds.map((round) => round.lockMinutesBefore)).toEqual(rounds.map(() => 5));
  });
});

describe('launch templates', () => {
  it('cover the six events from the stage 0 plan', () => {
    expect(FORMAT_TEMPLATES.map((t) => `${t.game}/${t.id}`)).toEqual([
      'dota2/ti',
      'dota2/pgl-wallachia',
      'dota2/blast-slam',
      'cs2/cs2-major',
      'lol/lol-worlds',
      'lol/lol-msi',
    ]);
  });

  it('publish a JSON Schema that matches the committed file', () => {
    expect(readCommitted('format.schema.json')).toEqual(formatJsonSchema());
  });

  it.each([
    // id, groups picks, groups max, bracket picks, bracket max, exact-score bonus max
    ['ti', 16, 190, 14, 195, 75],
    ['pgl-wallachia', 16, 180, 14, 195, 75],
    ['blast-slam', 8, 80, 10, 165, 55],
    ['cs2-major', 16, 180, 7, 120, 40],
    ['lol-worlds', 16, 180, 7, 120, 70],
    ['lol-msi', 0, 0, 14, 195, 140],
  ] as const)('%s: picks and maximum points', (id, gPicks, gMax, bPicks, bMax, bonus) => {
    const groups = groupsOf(id);
    const bracket = bracketOf(id);
    expect(groups ? [pickCount(groups), maxBasePoints(groups)] : [0, 0]).toEqual([gPicks, gMax]);
    expect([pickCount(bracket), maxBasePoints(bracket), maxExactScoreBonus(bracket)]).toEqual([
      bPicks,
      bMax,
      bonus,
    ]);
  });
});

describe('points follow the approved rules', () => {
  it('double elimination of 8: upper 10/15/20, lower 5/10/15/20, grand final 40', () => {
    expect(DOUBLE_ELIMINATION_8_POINTS).toEqual({
      ubqf: 10,
      ubsf: 15,
      ubf: 20,
      lbr1: 5,
      lbqf: 10,
      lbsf: 15,
      lbf: 20,
      gf: 40,
    });
    for (const id of ['ti', 'pgl-wallachia', 'lol-msi']) {
      const points = Object.fromEntries(bracketOf(id).rounds.map((r) => [r.id, r.points]));
      expect(points).toEqual(DOUBLE_ELIMINATION_8_POINTS);
    }
  });

  it('single elimination doubles every round up to 40 for the final', () => {
    expect(SINGLE_ELIMINATION_8_POINTS).toEqual({ qf: 10, sf: 20, final: 40 });
    for (const id of ['cs2-major', 'lol-worlds']) {
      const points = Object.fromEntries(bracketOf(id).rounds.map((r) => [r.id, r.points]));
      expect(points).toEqual(SINGLE_ELIMINATION_8_POINTS);
    }
  });

  it('Swiss: 15 for the 3-0 and 0-3 buckets, 10 for the rest', () => {
    for (const id of ['pgl-wallachia', 'cs2-major', 'lol-worlds']) {
      const stage = groupsOf(id) as SwissStage;
      const points = Object.fromEntries(stage.buckets.map((b) => [b.id, [b.size, b.points]]));
      expect(points).toEqual({
        '3-0': [2, 15],
        advance: [6, 10],
        eliminated: [6, 10],
        '0-3': [2, 15],
      });
    }
  });

  it('TI Swiss: 15 for the straight-through and out buckets, 10 for the elimination round', () => {
    const stage = groupsOf('ti') as SwissStage;
    const points = Object.fromEntries(stage.buckets.map((b) => [b.id, [b.size, b.points]]));
    expect(points).toEqual({
      direct: [3, 15],
      'elimination-won': [5, 10],
      'elimination-lost': [5, 10],
      out: [3, 15],
    });
  });

  it('GSL: 10 each for first and second in a group', () => {
    expect(groupsOf('blast-slam')).toMatchObject({
      kind: 'gsl',
      points: { first: 10, second: 10 },
    });
  });

  it('grand finals are Bo5 everywhere; LoL plays every bracket series Bo5', () => {
    for (const format of FORMAT_TEMPLATES) {
      const stage = bracketOf(format.id);
      const final = stage.rounds.find((round) => round.side === 'final');
      expect(final?.bestOf).toBe(5);
      if (format.game === 'lol') expect(stage.rounds.every((r) => r.bestOf === 5)).toBe(true);
    }
  });
});

describe('Swiss records match the 2026 standings', () => {
  it('a 16-team Swiss to three wins ends 2 / 3 / 3 / 3 / 3 / 2 (PGL Wallachia S9)', () => {
    const stage = groupsOf('pgl-wallachia') as SwissStage;
    expect(Object.fromEntries(swissRecordDistribution(stage) ?? [])).toEqual({
      '3-0': 2,
      '3-1': 3,
      '3-2': 3,
      '2-3': 3,
      '1-3': 3,
      '0-3': 2,
    });
  });

  it('TI 2026: one 4-0, two 4-1, five 3-2, five 2-3, two 1-4 and one 0-4', () => {
    const stage = groupsOf('ti') as SwissStage;
    expect(Object.fromEntries(swissRecordDistribution(stage) ?? [])).toEqual({
      '4-0': 1,
      '4-1': 2,
      '3-2': 5,
      '2-3': 5,
      '1-4': 2,
      '0-4': 1,
    });
  });
});

describe('bracket wiring replays the 2026 events on Liquipedia', () => {
  it('TI 2026 Main Event', () => {
    const games = matchups(
      bracketOf('ti'),
      ['IW', 'Spirit', 'VISION', 'BB', 'Liquid', 'Yandex', 'NGX', 'Falcons'],
      {
        'ubqf-1': 'Spirit',
        'ubqf-2': 'VISION',
        'ubqf-3': 'Yandex',
        'ubqf-4': 'NGX',
        'ubsf-1': 'VISION',
        'ubsf-2': 'Yandex',
        'lbr1-1': 'BB',
        'lbr1-2': 'Liquid',
        'lbqf-1': 'BB',
        'lbqf-2': 'Spirit',
        ubf: 'VISION',
        lbsf: 'Spirit',
        lbf: 'Spirit',
        gf: 'Spirit',
      },
    );
    expect(games).toMatchObject({
      'ubsf-1': 'Spirit vs VISION',
      'ubsf-2': 'Yandex vs NGX',
      'lbr1-1': 'IW vs BB',
      'lbr1-2': 'Liquid vs Falcons',
      'lbqf-1': 'NGX vs BB',
      'lbqf-2': 'Spirit vs Liquid',
      ubf: 'VISION vs Yandex',
      lbsf: 'BB vs Spirit',
      lbf: 'Yandex vs Spirit',
      gf: 'VISION vs Spirit',
    });
  });

  it('PGL Wallachia Season 9 playoffs', () => {
    const games = matchups(
      bracketOf('pgl-wallachia'),
      ['XG', 'Nemiga', 'NAVI', 'LGD', 'Aurora', 'GL', 'Yandex', '1w'],
      {
        'ubqf-1': 'XG',
        'ubqf-2': 'LGD',
        'ubqf-3': 'Aurora',
        'ubqf-4': 'Yandex',
        'ubsf-1': 'LGD',
        'ubsf-2': 'Yandex',
        'lbr1-1': 'NAVI',
        'lbr1-2': 'GL',
        'lbqf-1': 'NAVI',
        'lbqf-2': 'XG',
        ubf: 'Yandex',
        lbsf: 'NAVI',
        lbf: 'NAVI',
        gf: 'Yandex',
      },
    );
    expect(games).toMatchObject({
      'lbqf-1': 'Aurora vs NAVI',
      'lbqf-2': 'XG vs GL',
      lbsf: 'NAVI vs XG',
      lbf: 'LGD vs NAVI',
      gf: 'Yandex vs NAVI',
    });
  });

  it('MSI 2026 bracket stage', () => {
    const games = matchups(
      bracketOf('lol-msi'),
      ['BLG', 'T1', 'LYON', 'FUR', 'HLE', 'TSW', 'G2', 'TES'],
      {
        'ubqf-1': 'BLG',
        'ubqf-2': 'LYON',
        'ubqf-3': 'HLE',
        'ubqf-4': 'G2',
        'ubsf-1': 'BLG',
        'ubsf-2': 'HLE',
        'lbr1-1': 'T1',
        'lbr1-2': 'TSW',
        'lbqf-1': 'G2',
        'lbqf-2': 'LYON',
        ubf: 'BLG',
        lbsf: 'LYON',
        lbf: 'HLE',
        gf: 'HLE',
      },
    );
    expect(games).toMatchObject({
      'lbqf-1': 'G2 vs T1',
      'lbqf-2': 'LYON vs TSW',
      lbsf: 'G2 vs LYON',
      lbf: 'HLE vs LYON',
      gf: 'BLG vs HLE',
    });
  });

  it('BLAST Slam VIII playoffs (six teams)', () => {
    const games = matchups(
      bracketOf('blast-slam'),
      ['PARI', 'Yandex', 'LGD', 'Spirit', 'Aurora', '1w'],
      {
        'ubqf-1': 'Yandex',
        'ubqf-2': 'Aurora',
        'ubsf-1': 'Yandex',
        'ubsf-2': 'Spirit',
        'lbqf-1': 'PARI',
        'lbqf-2': 'Aurora',
        ubf: 'Yandex',
        lbsf: 'PARI',
        lbf: 'Spirit',
        gf: 'Yandex',
      },
    );
    expect(games).toEqual({
      'ubqf-1': 'Yandex vs LGD',
      'ubqf-2': 'Aurora vs 1w',
      'ubsf-1': 'PARI vs Yandex',
      'ubsf-2': 'Spirit vs Aurora',
      'lbqf-1': 'PARI vs 1w',
      'lbqf-2': 'Aurora vs LGD',
      ubf: 'Yandex vs Spirit',
      lbsf: 'PARI vs Aurora',
      lbf: 'Spirit vs PARI',
      gf: 'Yandex vs Spirit',
    });
  });
});

describe('resolveBracket', () => {
  it('drops picks that an earlier change made impossible', () => {
    const { slots, stalePicks } = resolveBracket(
      bracketOf('ti'),
      ['IW', 'Spirit', 'VISION', 'BB', 'Liquid', 'Yandex', 'NGX', 'Falcons'],
      {
        'ubqf-1': 'IW', // changed from Spirit; the later Spirit picks no longer fit
        'ubqf-2': 'VISION',
        'ubqf-3': 'Yandex',
        'ubqf-4': 'NGX',
        'ubsf-1': 'VISION',
        'ubsf-2': 'Yandex',
        'lbr1-1': 'BB',
        'lbr1-2': 'Liquid',
        'lbqf-1': 'BB',
        'lbqf-2': 'Spirit',
        ubf: 'VISION',
        lbsf: 'Spirit',
        lbf: 'Spirit',
        gf: 'Spirit',
      },
    );
    expect(stalePicks).toEqual(['lbqf-2', 'lbsf', 'lbf', 'gf']);
    expect(slots.find((slot) => slot.id === 'lbqf-2')).toMatchObject({
      top: 'IW',
      bottom: 'Liquid',
      winner: null,
    });
  });

  it('leaves slots empty until both teams are known', () => {
    const { slots } = resolveBracket(bracketOf('cs2-major'), [], {});
    expect(slots.every((slot) => slot.top === null && slot.winner === null)).toBe(true);
  });
});
