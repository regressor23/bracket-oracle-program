import type { BestOf, BracketRound, BracketStage } from './schema.js';
interface StageBase {
    id: string;
    name: string;
}
type RoundSpec = Pick<BracketRound, 'name' | 'bestOf' | 'points'>;
/** Points from the rules: upper 10 / 15 / 20, lower 5 / 10 / 15 / 20, grand final 40. */
export declare const DOUBLE_ELIMINATION_8_POINTS: {
    readonly ubqf: 10;
    readonly ubsf: 15;
    readonly ubf: 20;
    readonly lbr1: 5;
    readonly lbqf: 10;
    readonly lbsf: 15;
    readonly lbf: 20;
    readonly gf: 40;
};
/** Points from the rules: doubling each round, final 40. */
export declare const SINGLE_ELIMINATION_8_POINTS: {
    readonly qf: 10;
    readonly sf: 20;
    readonly final: 40;
};
/** Six-team double elimination: the 8-team points without the first lower round. */
export declare const DOUBLE_ELIMINATION_6_POINTS: {
    readonly ubqf: 10;
    readonly ubsf: 15;
    readonly ubf: 20;
    readonly lbqf: 10;
    readonly lbsf: 15;
    readonly lbf: 20;
    readonly gf: 40;
};
export interface DoubleElimination8Options extends StageBase {
    /** Round names in the organizer's wording, keyed by round id. */
    names?: Partial<Record<keyof typeof DOUBLE_ELIMINATION_8_POINTS, string>>;
    bestOf: BestOf;
    grandFinalBestOf: BestOf;
}
/** Eight teams; positions 1–8 fill the four upper quarterfinals from the top. */
export declare function doubleElimination8(options: DoubleElimination8Options): BracketStage;
export interface DoubleElimination6Options extends StageBase {
    bestOf: BestOf;
    grandFinalBestOf: BestOf;
}
/**
 * Six teams, as at BLAST Slam VIII and IX: positions 1 and 4 start in the upper semifinals,
 * positions 2–3 and 5–6 in the upper quarterfinals. Every lower-bracket match pairs an upper
 * semifinal loser with the quarterfinal loser from the other half.
 */
export declare function doubleElimination6(options: DoubleElimination6Options): BracketStage;
export interface SingleElimination8Options extends StageBase {
    rounds: Record<keyof typeof SINGLE_ELIMINATION_8_POINTS, Omit<RoundSpec, 'points'>>;
}
/** Eight teams; positions 1–8 fill the four quarterfinals from the top. */
export declare function singleElimination8(options: SingleElimination8Options): BracketStage;
export {};
//# sourceMappingURL=brackets.d.ts.map