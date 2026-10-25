import type { BestOf, FormatTemplate, Stage } from './schema.js';

/**
 * Bonus for the exact series score, on top of a correct winner (rules, "Bonuses"). Bo1 has no
 * score to guess; a technical win never earns the bonus, which the scorer checks per series.
 */
export const EXACT_SCORE_BONUS: Readonly<Record<BestOf, number>> = { 1: 0, 3: 5, 5: 10 };

/** The most base points a full, perfect prediction of the stage earns (no bonuses). */
export function maxBasePoints(stage: Stage): number {
  switch (stage.kind) {
    case 'swiss':
      return stage.buckets.reduce((sum, bucket) => sum + bucket.size * bucket.points, 0);
    case 'gsl':
      return stage.groups * (stage.points.first + stage.points.second);
    case 'round-robin':
      return (
        stage.groups *
        (stage.advancePerGroup * stage.points.perQualifier + stage.points.groupWinner)
      );
    case 'bracket': {
      const pointsByRound = new Map(stage.rounds.map((round) => [round.id, round.points]));
      return stage.slots.reduce((sum, slot) => sum + (pointsByRound.get(slot.round) ?? 0), 0);
    }
    case 'not-predicted':
      return 0;
  }
}

/** The most exact-score bonus points a bracket stage can add. Group stages have none. */
export function maxExactScoreBonus(stage: Stage): number {
  if (stage.kind !== 'bracket') return 0;
  const bonusByRound = new Map(
    stage.rounds.map((round) => [round.id, EXACT_SCORE_BONUS[round.bestOf]]),
  );
  return stage.slots.reduce((sum, slot) => sum + (bonusByRound.get(slot.round) ?? 0), 0);
}

/** The stage a product round predicts, or undefined when the template has no such round. */
export function roundStage(
  template: FormatTemplate,
  round: keyof FormatTemplate['rounds'],
): Stage | undefined {
  const config = template.rounds[round];
  return config && template.stages.find((stage) => stage.id === config.stage);
}

/** How many picks a full prediction of the stage has: teams for groups, series for brackets. */
export function pickCount(stage: Stage): number {
  switch (stage.kind) {
    case 'swiss':
      return stage.teams;
    case 'gsl':
      return stage.groups * 2;
    case 'round-robin':
      return stage.groups * (stage.advancePerGroup + 1);
    case 'bracket':
      return stage.slots.length;
    case 'not-predicted':
      return 0;
  }
}
