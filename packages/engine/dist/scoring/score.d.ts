import type { BracketOutcome, GslGroupOutcome, RoundRobinGroupOutcome, SwissOutcome } from '../formats/outcomes.js';
import type { Stage } from '../formats/schema.js';
import type { Prediction } from '../predictions/schema.js';
/**
 * Scoring (issue #24): points for one prediction against the outcome of the predicted stage, by
 * the rules (rules, «Скоринг і тай-брейк») and the template's points. Public so anyone can
 * recompute every score (ADR-12).
 *
 * Points are kept in tenths, as integers: 75 means 7.5 points (format templates, decision 5).
 * The underdog multiplier makes halves; integers keep every sum exact.
 */
/** A number of points multiplied by ten, for example 75 for 7.5 points. */
export type Tenths = number;
/** The stage outcome a prediction is scored against, as the engine's outcome functions give it. */
export type ActualOutcome = {
    kind: 'swiss';
    outcome: SwissOutcome;
} | {
    kind: 'gsl';
    groups: readonly GslGroupOutcome[];
} | {
    kind: 'round-robin';
    groups: readonly RoundRobinGroupOutcome[];
} | {
    kind: 'bracket';
    outcome: BracketOutcome;
};
/**
 * How many predictions of the round picked each team to win each bracket slot, counted at lock
 * across every pool (rules, underdog). Published with the round so anyone can recompute it.
 */
export interface PickShares {
    /** Every prediction of the round, including those with the slot left empty. */
    total: number;
    /** Slot id → team id → how many predictions picked that team to win the slot. */
    slots: Record<string, Record<string, number>>;
}
export interface ScoringSettings {
    /**
     * Underdog ×1.5 for correct bracket winners picked by fewer than 25% of the round's
     * predictions. Off unless the round turns it on and the shares at lock are given (P-20).
     */
    underdog?: PickShares;
    /**
     * Teams replaced before their first series in the round: old team id → new team id. Picks on
     * the old team move to the new one (rules, «Нестандартні ситуації»).
     */
    replacements?: Readonly<Record<string, string>>;
}
export type PickResult = 'correct' | 'wrong' | 'pending' | 'stale';
export interface PickScore {
    /** Where the pick is in the document, for example `picks.slots.ubqf-1`. */
    path: string;
    result: PickResult;
    /** Base points, with the underdog multiplier when it applies. */
    points: Tenths;
    /** Exact-score bonus. */
    bonus: Tenths;
    underdog: boolean;
}
export interface PredictionScore {
    /** Base points plus bonuses. */
    points: Tenths;
    correct: number;
    exactScores: number;
    /** Picks whose series are not decided yet. */
    pending: number;
    picks: PickScore[];
}
/** Formats tenths for display with one decimal, for example 75 → "7.5". */
export declare function formatPoints(tenths: Tenths): string;
/** Counts each slot's picked winners across predictions of a round, for the underdog rule. */
export declare function pickShares(predictions: readonly Prediction[]): PickShares;
/** True when fewer than 25% of the round's predictions picked this winner for the slot. */
export declare function isUnderdog(shares: PickShares, slot: string, team: string): boolean;
/**
 * Scores one prediction against the outcome of the stage it predicts. Empty picks score nothing
 * and are not listed. The caller checks the document first (`checkPrediction`); a stage of
 * another kind than the picks scores nothing.
 */
export declare function scorePrediction(stage: Stage, prediction: Prediction, actual: ActualOutcome, settings?: ScoringSettings): PredictionScore;
//# sourceMappingURL=score.d.ts.map