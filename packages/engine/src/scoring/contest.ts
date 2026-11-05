import {
  bracketOutcome,
  gslGroupOutcome,
  roundRobinGroupOutcome,
  swissOutcome,
  type BracketResults,
  type GslGroupResults,
  type OutcomeIssue,
  type RoundRobinGroupResults,
  type SeriesResult,
  type SwissResults,
} from '../formats/outcomes.js';
import { roundStage } from '../formats/points.js';
import type { FormatTemplate, Stage } from '../formats/schema.js';
import type { Round } from '../predictions/schema.js';
import { checkPrediction } from '../predictions/validate.js';
import { rankEntries } from './rank.js';
import { scorePrediction, type ActualOutcome, type ScoringSettings, type Tenths } from './score.js';

/**
 * A whole contest at once: from the official results of the predicted stage and every entry's
 * prediction come points and places. The platform's scoring jobs and `bracket-oracle-verify score`
 * both call this, so a published leaderboard can be recomputed exactly.
 */

/** Official results of one stage, in the shape the engine's outcome functions take. */
export type StageResults =
  | BracketResults
  | SwissResults
  | { groups: readonly GslGroupResults[] }
  | { groups: readonly RoundRobinGroupResults[] };

export interface StageOutcomeResult {
  actual: ActualOutcome;
  /** Every series is decided and nothing needs the admin. */
  complete: boolean;
  issues: OutcomeIssue[];
}

/** The outcome of a predicted stage from its official results. */
export function stageOutcome(stage: Stage, results: StageResults): StageOutcomeResult {
  switch (stage.kind) {
    case 'bracket': {
      const outcome = bracketOutcome(stage, results as BracketResults);
      return {
        actual: { kind: 'bracket', outcome },
        complete: outcome.complete,
        issues: outcome.issues,
      };
    }
    case 'swiss': {
      const outcome = swissOutcome(stage, results as SwissResults);
      return {
        actual: { kind: 'swiss', outcome },
        complete: outcome.complete,
        issues: outcome.issues,
      };
    }
    case 'gsl': {
      const groups = (results as { groups: readonly GslGroupResults[] }).groups.map((g) =>
        gslGroupOutcome(stage, g),
      );
      return {
        actual: { kind: 'gsl', groups },
        complete: groups.length === stage.groups && groups.every((g) => g.complete),
        issues: groups.flatMap((g) => g.issues),
      };
    }
    case 'round-robin': {
      const groups = (results as { groups: readonly RoundRobinGroupResults[] }).groups.map((g) =>
        roundRobinGroupOutcome(stage, g),
      );
      return {
        actual: { kind: 'round-robin', groups },
        complete:
          groups.length === stage.groups && groups.every((g) => g.complete && !g.needsOrder),
        issues: groups.flatMap((g) => g.issues),
      };
    }
    case 'not-predicted':
      throw new Error(`${stage.id} is not predicted`);
  }
}

/**
 * Maps played in a stage, for the tie-break: every game of every series in the results. A forfeit
 * plays no maps, whatever score the organizer records for it.
 */
export function mapsPlayed(stage: Stage, results: StageResults): number {
  const series: SeriesResult[] = [];
  const add = (value: SeriesResult | readonly SeriesResult[] | undefined) => {
    if (value === undefined) return;
    if (Array.isArray(value)) series.push(...(value as readonly SeriesResult[]));
    else series.push(value as SeriesResult);
  };
  switch (stage.kind) {
    case 'bracket':
      Object.values((results as BracketResults).series).forEach(add);
      break;
    case 'swiss': {
      const swiss = results as SwissResults;
      swiss.rounds.forEach(add);
      add(swiss.eliminationRound);
      break;
    }
    case 'gsl':
      for (const group of (results as { groups: readonly GslGroupResults[] }).groups) {
        Object.values(group.series).forEach(add);
      }
      break;
    case 'round-robin':
      for (const group of (results as { groups: readonly RoundRobinGroupResults[] }).groups) {
        add(group.series);
        add(group.tiebreakers);
      }
      break;
    case 'not-predicted':
      break;
  }
  return series.reduce((sum, s) => sum + (s.forfeit ? 0 : s.score1 + s.score2), 0);
}

export interface ContestEntry {
  id: string;
  /** The prediction document as saved; it is checked before scoring. */
  prediction: unknown;
}

export interface ContestInput {
  template: FormatTemplate;
  round: Round;
  /** When set, every prediction must be for this contest. */
  contest?: string;
  results: StageResults;
  entries: readonly ContestEntry[];
  settings?: ScoringSettings;
}

export interface ScoredEntry {
  id: string;
  /** SHA-256 of the prediction's canonical JSON; null when the document is not valid. */
  hash: string | null;
  points: Tenths;
  correct: number;
  exactScores: number;
  pending: number;
  tiebreak: number | null;
  distance: number | null;
  /** Null for an invalid document: it scores nothing and is not ranked. */
  place: { from: number; to: number } | null;
  /** Why the prediction scores nothing: it is not a valid document for this contest. */
  issues: string[];
}

export interface ContestScore {
  template: { id: string; version: number };
  round: Round;
  stage: string;
  complete: boolean;
  /** Maps played in the stage; known once the stage is complete. */
  mapsPlayed: number | null;
  /** Problems in the results; points are computed from what can be decided. */
  issues: OutcomeIssue[];
  /** Best place first; invalid documents last, without a place. */
  entries: ScoredEntry[];
}

export function scoreContest(input: ContestInput): ContestScore {
  const { template, round, results, settings } = input;
  const stage = roundStage(template, round);
  if (!stage || stage.kind === 'not-predicted') {
    throw new Error(`${template.id} has no ${round} round`);
  }
  const outcome = stageOutcome(stage, results);
  const maps = outcome.complete ? mapsPlayed(stage, results) : null;

  const scored = input.entries.map((entry) => {
    const check = checkPrediction(entry.prediction, {
      template,
      ...(input.contest === undefined ? {} : { contest: input.contest }),
    });
    const issues = check.issues.map((i) => `${i.path || '<root>'}: ${i.message}`);
    if (check.prediction && check.prediction.round !== round) {
      issues.push(`round: the prediction is for the ${check.prediction.round} round`);
    }
    if (!check.prediction || issues.length > 0) {
      return {
        id: entry.id,
        hash: check.hash,
        points: 0,
        correct: 0,
        exactScores: 0,
        pending: 0,
        tiebreak: null,
        issues,
      };
    }
    const score = scorePrediction(stage, check.prediction, outcome.actual, settings);
    return {
      id: entry.id,
      hash: check.hash,
      points: score.points,
      correct: score.correct,
      exactScores: score.exactScores,
      pending: score.pending,
      tiebreak: check.prediction.tiebreak?.maps ?? null,
      issues,
    };
  });

  const valid = scored.filter((s) => s.issues.length === 0);
  const invalid = scored.filter((s) => s.issues.length > 0);
  const byId = new Map(valid.map((s) => [s.id, s]));
  const ranked = rankEntries(
    valid.map(({ id, points, tiebreak }) => ({ id, points, tiebreak })),
    maps,
  );
  return {
    template: { id: template.id, version: template.version },
    round,
    stage: stage.id,
    complete: outcome.complete,
    mapsPlayed: maps,
    issues: outcome.issues,
    entries: [
      ...ranked.map((r) => ({ ...byId.get(r.id)!, distance: r.distance, place: r.place })),
      ...invalid.map((s) => ({ ...s, distance: null, place: null })),
    ],
  };
}
