import { type FormatTemplate, type SwissStage } from './schema.js';
export interface FormatIssue {
    /** Dotted path into the template, for example "stages[2].slots[5].top". */
    path: string;
    message: string;
}
export type FormatValidation = {
    ok: true;
    template: FormatTemplate;
} | {
    ok: false;
    issues: FormatIssue[];
};
/**
 * How many teams finish a Swiss stage on each record, when teams always play opponents with the
 * same record. Returns null when some record group has an odd number of teams, because then the
 * organizer's bye or cross-record pairing decides the split and the counts are not fixed.
 */
export declare function swissRecordDistribution(stage: Pick<SwissStage, 'teams' | 'winsToFinish' | 'lossesToFinish' | 'rounds'>): Map<string, number> | null;
/** Checks that need the whole template; run after the Zod schema accepts the shape. */
export declare function checkTemplate(template: FormatTemplate): FormatIssue[];
/** Parses unknown JSON as a format template and runs every check. */
export declare function validateFormat(input: unknown): FormatValidation;
//# sourceMappingURL=validate.d.ts.map