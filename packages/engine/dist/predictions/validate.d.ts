import type { BestOf, FormatTemplate } from '../formats/schema.js';
import { type Prediction, type StageParticipants } from './schema.js';
/**
 * Checks a prediction document against its format template and, when known, the stage's teams.
 *
 * - `issues` make the document invalid: a wrong shape, an unknown slot or bucket, a full bucket,
 *   a score that cannot end the series. The platform refuses to save such a document.
 * - `stale` lists picks that no longer fit: a team that is not in the stage, or a bracket winner
 *   who is not one of the two teams the player's earlier picks put in that slot. They are kept,
 *   reported and score nothing.
 * - `missing` lists what is still empty; an incomplete prediction is allowed (rules, "Incomplete
 *   bracket") and the player is reminded before lock.
 */
export interface PredictionIssue {
    /** Where the problem is, for example `picks.slots.ubqf-1.score`. */
    path: string;
    message: string;
}
export interface PredictionCheck {
    /** True when there are no issues; stale and missing picks do not make a document invalid. */
    ok: boolean;
    /** The parsed document, when its shape is valid. */
    prediction: Prediction | null;
    /** SHA-256 of the canonical JSON of the document: what the wallet signs. */
    hash: string | null;
    issues: PredictionIssue[];
    stale: string[];
    missing: string[];
    /** Every pick made and the tie-break answered. Known only when the teams are given. */
    complete: boolean | null;
}
export interface PredictionCheckOptions {
    /** The template to check against; by default the engine's template with the document's id. */
    template?: FormatTemplate;
    /** The stage's teams; without them stale and missing picks cannot be told. */
    participants?: StageParticipants;
    /** When set, the document must belong to this contest. */
    contest?: string;
}
/** Valid exact scores, winner first, for a series length. */
export declare function exactScores(bestOf: BestOf): [number, number][];
/** Validates, hashes and reports on a prediction document. Never throws on bad input. */
export declare function checkPrediction(input: unknown, options?: PredictionCheckOptions): PredictionCheck;
/** How many picks the document makes, counted the way `pickCount` counts a full prediction. */
export declare function picksMade(picks: Prediction['picks']): number;
/** The SHA-256 of a prediction's canonical JSON, the value the wallet signs. */
export declare function predictionHash(prediction: Prediction): string;
//# sourceMappingURL=validate.d.ts.map