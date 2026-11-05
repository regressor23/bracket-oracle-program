import { z } from 'zod';
/**
 * The prediction document (issue #23): what a player saves for one round of a tournament. The
 * platform stores it as canonical JSON, the player's wallet signs its SHA-256, and the hashes of
 * all documents of a round become the entries root at lock (ADR-09). The format is public so
 * anyone can check that a saved bracket was scored as it was signed.
 *
 * Teams, contests and tournaments are referred to by the ids the platform publishes with the
 * round. Points never appear here: they come from the format template and the results.
 */
/** Version of this document format. A new format gets a new number; old documents stay valid. */
export declare const PREDICTION_FORMAT = 1;
export declare const entityIdSchema: z.ZodString;
export declare const swissPicksSchema: z.ZodObject<{
    kind: z.ZodLiteral<"swiss">;
    buckets: z.ZodRecord<z.ZodString, z.ZodString>;
}, z.core.$strict>;
export declare const gslPicksSchema: z.ZodObject<{
    kind: z.ZodLiteral<"gsl">;
    groups: z.ZodRecord<z.ZodString, z.ZodObject<{
        first: z.ZodOptional<z.ZodString>;
        second: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const roundRobinPicksSchema: z.ZodObject<{
    kind: z.ZodLiteral<"round-robin">;
    groups: z.ZodRecord<z.ZodString, z.ZodObject<{
        qualifiers: z.ZodArray<z.ZodString>;
        winner: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const bracketPickSchema: z.ZodObject<{
    winner: z.ZodString;
    score: z.ZodOptional<z.ZodTuple<[z.ZodInt, z.ZodInt], null>>;
}, z.core.$strict>;
export type BracketPick = z.infer<typeof bracketPickSchema>;
export declare const bracketPicksSchema: z.ZodObject<{
    kind: z.ZodLiteral<"bracket">;
    slots: z.ZodRecord<z.ZodString, z.ZodObject<{
        winner: z.ZodString;
        score: z.ZodOptional<z.ZodTuple<[z.ZodInt, z.ZodInt], null>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const picksSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"swiss">;
    buckets: z.ZodRecord<z.ZodString, z.ZodString>;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"gsl">;
    groups: z.ZodRecord<z.ZodString, z.ZodObject<{
        first: z.ZodOptional<z.ZodString>;
        second: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"round-robin">;
    groups: z.ZodRecord<z.ZodString, z.ZodObject<{
        qualifiers: z.ZodArray<z.ZodString>;
        winner: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"bracket">;
    slots: z.ZodRecord<z.ZodString, z.ZodObject<{
        winner: z.ZodString;
        score: z.ZodOptional<z.ZodTuple<[z.ZodInt, z.ZodInt], null>>;
    }, z.core.$strict>>;
}, z.core.$strict>], "kind">;
export type Picks = z.infer<typeof picksSchema>;
export type SwissPicks = z.infer<typeof swissPicksSchema>;
export type GslPicks = z.infer<typeof gslPicksSchema>;
export type RoundRobinPicks = z.infer<typeof roundRobinPicksSchema>;
export type BracketPicks = z.infer<typeof bracketPicksSchema>;
export declare const roundSchema: z.ZodEnum<{
    groups: "groups";
    bracket: "bracket";
}>;
export type Round = z.infer<typeof roundSchema>;
export declare const predictionSchema: z.ZodObject<{
    format: z.ZodLiteral<1>;
    tournament: z.ZodString;
    contest: z.ZodString;
    round: z.ZodEnum<{
        groups: "groups";
        bracket: "bracket";
    }>;
    template: z.ZodObject<{
        id: z.ZodString;
        version: z.ZodInt;
    }, z.core.$strict>;
    revision: z.ZodInt;
    picks: z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"swiss">;
        buckets: z.ZodRecord<z.ZodString, z.ZodString>;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"gsl">;
        groups: z.ZodRecord<z.ZodString, z.ZodObject<{
            first: z.ZodOptional<z.ZodString>;
            second: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"round-robin">;
        groups: z.ZodRecord<z.ZodString, z.ZodObject<{
            qualifiers: z.ZodArray<z.ZodString>;
            winner: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"bracket">;
        slots: z.ZodRecord<z.ZodString, z.ZodObject<{
            winner: z.ZodString;
            score: z.ZodOptional<z.ZodTuple<[z.ZodInt, z.ZodInt], null>>;
        }, z.core.$strict>>;
    }, z.core.$strict>], "kind">;
    tiebreak: z.ZodNullable<z.ZodObject<{
        maps: z.ZodInt;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type Prediction = z.infer<typeof predictionSchema>;
/**
 * The teams of the predicted stage, as the platform publishes them when the round opens. Picks
 * are checked against them; a team that is not listed (for example one replaced before its first
 * series) makes the pick stale.
 */
export declare const stageParticipantsSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"swiss">;
    teams: z.ZodArray<z.ZodString>;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"gsl">;
    groups: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"round-robin">;
    groups: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"bracket">;
    positions: z.ZodArray<z.ZodNullable<z.ZodString>>;
}, z.core.$strict>], "kind">;
export type StageParticipants = z.infer<typeof stageParticipantsSchema>;
//# sourceMappingURL=schema.d.ts.map