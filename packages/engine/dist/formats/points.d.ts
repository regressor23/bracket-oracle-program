import type { BestOf, FormatTemplate, Stage } from './schema.js';
/**
 * Bonus for the exact series score, on top of a correct winner (rules, "Bonuses"). Bo1 has no
 * score to guess; a technical win never earns the bonus, which the scorer checks per series.
 */
export declare const EXACT_SCORE_BONUS: Readonly<Record<BestOf, number>>;
/** The most base points a full, perfect prediction of the stage earns (no bonuses). */
export declare function maxBasePoints(stage: Stage): number;
/** The most exact-score bonus points a bracket stage can add. Group stages have none. */
export declare function maxExactScoreBonus(stage: Stage): number;
/** The stage a product round predicts, or undefined when the template has no such round. */
export declare function roundStage(template: FormatTemplate, round: keyof FormatTemplate['rounds']): Stage | undefined;
/** How many picks a full prediction of the stage has: teams for groups, series for brackets. */
export declare function pickCount(stage: Stage): number;
//# sourceMappingURL=points.d.ts.map