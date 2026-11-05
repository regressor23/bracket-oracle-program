import { type BracketResults, type GslGroupResults, type OutcomeIssue, type RoundRobinGroupResults, type SwissResults } from '../formats/outcomes.js';
import type { FormatTemplate, Stage } from '../formats/schema.js';
import type { Round } from '../predictions/schema.js';
import { type ActualOutcome, type ScoringSettings, type Tenths } from './score.js';
/**
 * A whole contest at once: from the official results of the predicted stage and every entry's
 * prediction come points and places. The platform's scoring jobs and `bracket-oracle-verify score`
 * both call this, so a published leaderboard can be recomputed exactly.
 */
/** Official results of one stage, in the shape the engine's outcome functions take. */
export type StageResults = BracketResults | SwissResults | {
    groups: readonly GslGroupResults[];
} | {
    groups: readonly RoundRobinGroupResults[];
};
export interface StageOutcomeResult {
    actual: ActualOutcome;
    /** Every series is decided and nothing needs the admin. */
    complete: boolean;
    issues: OutcomeIssue[];
}
/** The outcome of a predicted stage from its official results. */
export declare function stageOutcome(stage: Stage, results: StageResults): StageOutcomeResult;
/**
 * Maps played in a stage, for the tie-break: every game of every series in the results. A forfeit
 * plays no maps, whatever score the organizer records for it.
 */
export declare function mapsPlayed(stage: Stage, results: StageResults): number;
export interface ContestEntry {
    id: string;
    /** The prediction document as saved; it is checked before scoring. */
    prediction: unknown;
}
export interface ContestInput {
    template: FormatTemplate;
    round: Round;
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
    place: {
        from: number;
        to: number;
    };
    /** Why the prediction scores nothing: it is not a valid document for this contest. */
    issues: string[];
}
export interface ContestScore {
    template: {
        id: string;
        version: number;
    };
    round: Round;
    stage: string;
    complete: boolean;
    /** Maps played in the stage; known once the stage is complete. */
    mapsPlayed: number | null;
    /** Problems in the results; points are computed from what can be decided. */
    issues: OutcomeIssue[];
    /** Best place first. */
    entries: ScoredEntry[];
}
export declare function scoreContest(input: ContestInput): ContestScore;
//# sourceMappingURL=contest.d.ts.map