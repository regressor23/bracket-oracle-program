import type { BracketStage, GslStage, RoundRobinStage, SwissStage } from './schema.js';
/**
 * Stage outcomes from official series results (issue #9): who won every bracket slot, where each
 * team finished in a Swiss stage, a GSL group or a round-robin table. Scoring compares picks with
 * these outcomes, so they live in the public engine where anyone can recompute them.
 *
 * Functions never throw on bad data. They return what can be decided and list every problem in
 * `issues`, so an admin sees all of them at once.
 */
/** One series as an official source reports it. */
export interface SeriesResult {
    team1: string;
    team2: string;
    score1: number;
    score2: number;
    /** Required for a forfeit or a walkover, where the score does not show the winner. */
    winner?: string;
    forfeit?: boolean;
}
export interface OutcomeIssue {
    /** Where the problem is: a slot id, `round 2`, `group A`, … */
    at: string;
    message: string;
}
export interface BracketResults {
    /** Team ids for positions 1..teams, top of the bracket first. */
    positions: readonly (string | null)[];
    /** Results per slot id. A grand final with a bracket reset lists both series in order. */
    series: Readonly<Record<string, SeriesResult | readonly SeriesResult[]>>;
}
export interface BracketSlotOutcome {
    id: string;
    round: string;
    top: string | null;
    bottom: string | null;
    winner: string | null;
    loser: string | null;
    /** Score of the deciding series, top team first; null until decided. */
    score: [number, number] | null;
    forfeit: boolean;
}
export interface Placement {
    team: string;
    /** Shared places are a range, for example 5–6 for both lower quarterfinal losers. */
    from: number;
    to: number;
}
export interface BracketOutcome {
    slots: BracketSlotOutcome[];
    champion: string | null;
    /** Champion first, then teams in the order they were knocked out, best place first. */
    placements: Placement[];
    complete: boolean;
    issues: OutcomeIssue[];
}
export declare function bracketOutcome(stage: BracketStage, results: BracketResults): BracketOutcome;
export interface SwissResults {
    /** Every team in the stage. */
    teams: readonly string[];
    /** Series of each Swiss round, round 1 first. */
    rounds: readonly (readonly SeriesResult[])[];
    /** Elimination-round series, for stages that have one (The International). */
    eliminationRound?: readonly SeriesResult[];
}
export interface SwissTeamOutcome {
    team: string;
    wins: number;
    losses: number;
    /** "wins-losses", for example "3-1". */
    record: string;
    /** Swiss round in which the team stopped playing; null while it still plays. */
    finishedInRound: number | null;
    eliminationRound: 'won' | 'lost' | null;
    /** Bucket the team ended in; null until known. */
    bucket: string | null;
}
export interface SwissOutcome {
    teams: SwissTeamOutcome[];
    complete: boolean;
    issues: OutcomeIssue[];
}
export declare function swissOutcome(stage: SwissStage, results: SwissResults): SwissOutcome;
export interface GslGroupResults {
    group: string;
    /** The four teams of the group. */
    teams: readonly [string, string, string, string];
    series: {
        opening1?: SeriesResult;
        opening2?: SeriesResult;
        /** Winners of the openings. */
        winners?: SeriesResult;
        /** Losers of the openings. */
        elimination?: SeriesResult;
        /** Loser of the winners match against the winner of the elimination match. */
        decider?: SeriesResult;
    };
}
export interface GslGroupOutcome {
    group: string;
    first: string | null;
    second: string | null;
    third: string | null;
    fourth: string | null;
    complete: boolean;
    issues: OutcomeIssue[];
}
export declare function gslGroupOutcome(stage: GslStage, results: GslGroupResults): GslGroupOutcome;
export interface RoundRobinGroupResults {
    group: string;
    teams: readonly string[];
    series: readonly SeriesResult[];
    /** Extra series the organizer plays to split teams tied on points and map difference. */
    tiebreakers?: readonly SeriesResult[];
    /**
     * Final order of the group, set by the admin when the organizer's own tiebreak rules decide
     * (head-to-head, coin flip, …). When given, it is the order.
     */
    order?: readonly string[];
    /** Table points per series; the default is 3 for a win and 1 for a draw. */
    points?: {
        win: number;
        draw: number;
    };
}
export interface RoundRobinRow {
    team: string;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    mapsWon: number;
    mapsLost: number;
    mapDifference: number;
    points: number;
    /** 1-based; teams in an unresolved tie share the best rank of the tie. */
    rank: number;
}
export interface RoundRobinGroupOutcome {
    group: string;
    table: RoundRobinRow[];
    /** Teams that advance, best first; null while a tie across the cut is unresolved. */
    qualifiers: string[] | null;
    winner: string | null;
    /** A tie decides who advances or wins the group: the admin must supply `order`. */
    needsOrder: boolean;
    complete: boolean;
    issues: OutcomeIssue[];
}
export declare function roundRobinGroupOutcome(stage: RoundRobinStage, results: RoundRobinGroupResults): RoundRobinGroupOutcome;
//# sourceMappingURL=outcomes.d.ts.map