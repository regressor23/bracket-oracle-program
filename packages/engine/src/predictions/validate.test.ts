import { describe, expect, it } from 'vitest';
import type { FormatTemplate } from '../formats/schema.js';
import { blastSlam, pglWallachia, theInternational } from '../formats/templates.js';
import { hashCanonical } from '../hash.js';
import type { Picks, Prediction, StageParticipants } from './schema.js';
import { checkPrediction, exactScores, predictionHash } from './validate.js';

const TEAMS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function prediction(picks: Picks, extra: Partial<Prediction> = {}): Prediction {
  return {
    format: 1,
    tournament: 'ti-2026',
    contest: 'ti-2026-bracket',
    round: picks.kind === 'bracket' ? 'bracket' : 'groups',
    template: { id: 'ti', version: 1 },
    revision: 1,
    picks,
    tiebreak: { maps: 31 },
    ...extra,
  };
}

const bracketTeams: StageParticipants = { kind: 'bracket', positions: TEAMS };

/** A full TI main event: the top team of every slot wins, 2-0 everywhere, 3-1 in the final. */
function fullBracket(): Prediction {
  const slots: Record<string, { winner: string; score?: [number, number] }> = {
    'ubqf-1': { winner: 'a', score: [2, 0] },
    'ubqf-2': { winner: 'c' },
    'ubsf-1': { winner: 'a' },
    'ubqf-3': { winner: 'e' },
    'ubqf-4': { winner: 'g' },
    'ubsf-2': { winner: 'e' },
    ubf: { winner: 'a' },
    'lbr1-1': { winner: 'b' },
    'lbr1-2': { winner: 'f' },
    'lbqf-1': { winner: 'g' },
    'lbqf-2': { winner: 'c' },
    lbsf: { winner: 'g' },
    lbf: { winner: 'e' },
    gf: { winner: 'a', score: [3, 1] },
  };
  return prediction({ kind: 'bracket', slots });
}

describe('checkPrediction: brackets', () => {
  it('accepts a full bracket and hashes its canonical JSON', () => {
    const doc = fullBracket();
    const check = checkPrediction(doc, { participants: bracketTeams, contest: 'ti-2026-bracket' });
    expect(check.issues).toEqual([]);
    expect(check).toMatchObject({ ok: true, stale: [], missing: [], complete: true });
    expect(check.hash).toBe(hashCanonical(JSON.parse(JSON.stringify(doc))));
    expect(check.hash).toBe(predictionHash(doc));
  });

  it('allows an incomplete bracket and lists the empty slots and the tie-break', () => {
    const doc = prediction(
      { kind: 'bracket', slots: { 'ubqf-1': { winner: 'b' }, gf: { winner: 'b' } } },
      { tiebreak: null },
    );
    const check = checkPrediction(doc, { participants: bracketTeams });
    expect(check.ok).toBe(true);
    expect(check.complete).toBe(false);
    expect(check.missing).toHaveLength(12 + 1);
    expect(check.missing).toContain('picks.slots.ubf');
    expect(check.missing.at(-1)).toBe('tiebreak');
    // The final needs both finalists picked first; until then the pick does not fit.
    expect(check.stale).toEqual(['picks.slots.gf']);
  });

  it('reports picks that no longer fit the earlier picks as stale', () => {
    const doc = fullBracket();
    if (doc.picks.kind !== 'bracket') throw new Error('bracket expected');
    // The player changed ubqf-1 to b but left the rest: a no longer reaches the upper semifinal
    // or the final, b no longer plays the first lower round, and the picks on c and e that came
    // through those slots follow. g still reaches lbqf-1 and lbsf through the player's own picks.
    doc.picks.slots['ubqf-1'] = { winner: 'b' };
    const check = checkPrediction(doc, { participants: bracketTeams });
    expect(check.ok).toBe(true);
    expect(check.stale).toEqual(
      ['ubsf-1', 'lbr1-1', 'lbqf-2', 'ubf', 'lbf', 'gf'].map((slot) => `picks.slots.${slot}`),
    );
  });

  it('reports a pick on a team that is no longer in the stage as stale', () => {
    const replaced: StageParticipants = { kind: 'bracket', positions: ['z', ...TEAMS.slice(1)] };
    const check = checkPrediction(fullBracket(), { participants: replaced });
    expect(check.ok).toBe(true);
    expect(check.stale).toContain('picks.slots.ubqf-1');
  });

  it('refuses unknown slots, exact scores that cannot end the series and a Bo1 score', () => {
    const doc = prediction({
      kind: 'bracket',
      slots: {
        'ubqf-9': { winner: 'a' },
        'ubqf-1': { winner: 'a', score: [2, 2] },
        gf: { winner: 'a', score: [2, 1] },
      },
    });
    expect(checkPrediction(doc).issues).toEqual([
      { path: 'picks.slots.ubqf-9', message: 'unknown slot "ubqf-9"' },
      { path: 'picks.slots.ubqf-1.score', message: '2-2 does not end a Bo3' },
      { path: 'picks.slots.gf.score', message: '2-1 does not end a Bo5' },
    ]);
    expect(exactScores(1)).toEqual([]);
    expect(exactScores(3)).toEqual([
      [2, 0],
      [2, 1],
    ]);
    expect(exactScores(5)).toEqual([
      [3, 0],
      [3, 1],
      [3, 2],
    ]);
  });

  it('refuses a document for another contest, template version or round', () => {
    expect(checkPrediction(fullBracket(), { contest: 'other' }).issues).toEqual([
      { path: 'contest', message: 'the prediction is for contest ti-2026-bracket, not other' },
    ]);
    const old = prediction({ kind: 'bracket', slots: {} }, { template: { id: 'ti', version: 7 } });
    expect(checkPrediction(old).issues[0]?.message).toBe(
      'the prediction uses ti v7, the round uses ti v1',
    );
    const msi = prediction(
      { kind: 'swiss', buckets: {} },
      { template: { id: 'lol-msi', version: 1 }, round: 'groups' },
    );
    expect(checkPrediction(msi).issues).toEqual([
      { path: 'round', message: 'lol-msi has no groups round' },
    ]);
    const wrongKind = prediction({ kind: 'swiss', buckets: {} }, { round: 'bracket' });
    expect(checkPrediction(wrongKind).issues[0]?.message).toBe(
      'the bracket round predicts a bracket stage, not swiss',
    );
  });

  it('refuses a malformed document without throwing', () => {
    const check = checkPrediction({ ...fullBracket(), format: 2, extra: true });
    expect(check.ok).toBe(false);
    expect(check.hash).toBeNull();
    expect(check.issues.map((i) => i.path)).toEqual(['format', '']);
    expect(checkPrediction('not a document').ok).toBe(false);
  });
});

describe('checkPrediction: group stages', () => {
  const swissTeams: StageParticipants = {
    kind: 'swiss',
    teams: Array.from({ length: 16 }, (_, i) => `t${i + 1}`),
  };

  it('checks Swiss buckets against their sizes and the teams', () => {
    const buckets: Record<string, string> = {
      t1: 'direct',
      t2: 'direct',
      t3: 'direct',
      t4: 'direct',
      t5: 'elimination-won',
      outsider: 'out',
    };
    const check = checkPrediction(prediction({ kind: 'swiss', buckets }), {
      participants: swissTeams,
    });
    expect(check.issues).toEqual([
      { path: 'picks.buckets', message: 'bucket "direct" holds 4 teams, it has room for 3' },
    ]);
    expect(check.stale).toEqual(['picks.buckets.outsider']);
    expect(check.missing).toHaveLength(11);
    expect(check.complete).toBeNull();

    const unknown = checkPrediction(prediction({ kind: 'swiss', buckets: { t1: 'champion' } }));
    expect(unknown.issues).toEqual([
      { path: 'picks.buckets.t1', message: 'unknown bucket "champion"' },
    ]);
  });

  it('checks GSL groups', () => {
    const doc = prediction(
      {
        kind: 'gsl',
        groups: { A: { first: 'a', second: 'a' }, B: { first: 'e', second: 'x' }, Z: {} },
      },
      { template: { id: 'blast-slam', version: blastSlam.version } },
    );
    const teams: StageParticipants = {
      kind: 'gsl',
      groups: { A: ['a', 'b', 'c', 'd'], B: ['e', 'f', 'g', 'h'] },
    };
    const check = checkPrediction(doc, { participants: teams });
    expect(check.issues).toEqual([
      { path: 'picks.groups.A', message: 'a cannot finish both first and second' },
      { path: 'picks.groups.Z', message: 'unknown group "Z"' },
    ]);
    expect(check.stale).toEqual(['picks.groups.B.second']);
  });

  it('checks round-robin qualifiers and the group winner', () => {
    const template: FormatTemplate = structuredClone(pglWallachia);
    template.id = 'round-robin-test';
    template.stages[0] = {
      id: 'group-stage',
      name: 'Group stage',
      kind: 'round-robin',
      groups: 2,
      teamsPerGroup: 4,
      advancePerGroup: 2,
      bestOf: 2,
      points: { perQualifier: 10, groupWinner: 10 },
    };
    const doc = prediction(
      {
        kind: 'round-robin',
        groups: {
          A: { qualifiers: ['a', 'b', 'c'], winner: 'd' },
          B: { qualifiers: ['e', 'e'] },
        },
      },
      { template: { id: 'round-robin-test', version: template.version } },
    );
    const teams: StageParticipants = {
      kind: 'round-robin',
      groups: { A: ['a', 'b', 'c', 'd'], B: ['e', 'f', 'g', 'h'] },
    };
    const check = checkPrediction(doc, { template, participants: teams });
    expect(check.issues).toEqual([
      { path: 'picks.groups.A.qualifiers', message: '3 qualifiers picked, 2 advance' },
      {
        path: 'picks.groups.A.winner',
        message: 'the group winner d must be one of the qualifiers',
      },
      { path: 'picks.groups.B.qualifiers', message: 'a team is listed twice' },
    ]);

    const fine = prediction(
      {
        kind: 'round-robin',
        groups: { A: { qualifiers: ['a', 'b'], winner: 'a' }, B: { qualifiers: ['e'] } },
      },
      { template: { id: 'round-robin-test', version: template.version } },
    );
    const partial = checkPrediction(fine, { template, participants: teams });
    expect(partial.ok).toBe(true);
    expect(partial.missing).toEqual(['picks.groups.B.qualifiers', 'picks.groups.B.winner']);
  });

  it('uses the template the caller gives, not only the built-in ones', () => {
    const doc = prediction({ kind: 'swiss', buckets: {} }, { template: { id: 'ti', version: 1 } });
    expect(checkPrediction(doc, { template: theInternational }).ok).toBe(true);
  });
});
