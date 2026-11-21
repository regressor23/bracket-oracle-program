import { z } from 'zod';
export declare const gameSchema: z.ZodEnum<{
    dota2: "dota2";
    cs2: "cs2";
    lol: "lol";
}>;
export type Game = z.infer<typeof gameSchema>;
export declare const bestOfSchema: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<3>, z.ZodLiteral<5>]>;
export type BestOf = z.infer<typeof bestOfSchema>;
export declare const swissBucketSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    size: z.ZodInt;
    points: z.ZodInt;
    records: z.ZodArray<z.ZodString>;
    eliminationRound: z.ZodOptional<z.ZodEnum<{
        won: "won";
        lost: "lost";
    }>>;
    advances: z.ZodBoolean;
}, z.core.$strict>;
export type SwissBucket = z.infer<typeof swissBucketSchema>;
export declare const swissStageSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    kind: z.ZodLiteral<"swiss">;
    teams: z.ZodInt;
    winsToFinish: z.ZodInt;
    lossesToFinish: z.ZodInt;
    rounds: z.ZodInt;
    bestOf: z.ZodObject<{
        decisive: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<3>, z.ZodLiteral<5>]>;
        other: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<3>, z.ZodLiteral<5>]>;
    }, z.core.$strict>;
    eliminationRound: z.ZodOptional<z.ZodObject<{
        records: z.ZodArray<z.ZodString>;
        bestOf: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<3>, z.ZodLiteral<5>]>;
        pairing: z.ZodEnum<{
            "higher-seed-picks-opponent": "higher-seed-picks-opponent";
            organizer: "organizer";
        }>;
    }, z.core.$strict>>;
    buckets: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        size: z.ZodInt;
        points: z.ZodInt;
        records: z.ZodArray<z.ZodString>;
        eliminationRound: z.ZodOptional<z.ZodEnum<{
            won: "won";
            lost: "lost";
        }>>;
        advances: z.ZodBoolean;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type SwissStage = z.infer<typeof swissStageSchema>;
export declare const gslStageSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    kind: z.ZodLiteral<"gsl">;
    groups: z.ZodInt;
    bestOf: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<3>, z.ZodLiteral<5>]>;
    points: z.ZodObject<{
        first: z.ZodInt;
        second: z.ZodInt;
    }, z.core.$strict>;
}, z.core.$strict>;
export type GslStage = z.infer<typeof gslStageSchema>;
export declare const roundRobinStageSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    kind: z.ZodLiteral<"round-robin">;
    groups: z.ZodInt;
    teamsPerGroup: z.ZodInt;
    advancePerGroup: z.ZodInt;
    bestOf: z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<3>, z.ZodLiteral<5>]>, z.ZodLiteral<2>]>;
    points: z.ZodObject<{
        perQualifier: z.ZodInt;
        groupWinner: z.ZodInt;
    }, z.core.$strict>;
}, z.core.$strict>;
export type RoundRobinStage = z.infer<typeof roundRobinStageSchema>;
export declare const slotSourceSchema: z.ZodUnion<readonly [z.ZodObject<{
    position: z.ZodInt;
}, z.core.$strict>, z.ZodObject<{
    winnerOf: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    loserOf: z.ZodString;
}, z.core.$strict>]>;
export type SlotSource = z.infer<typeof slotSourceSchema>;
export declare const bracketRoundSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    side: z.ZodEnum<{
        upper: "upper";
        lower: "lower";
        final: "final";
    }>;
    bestOf: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<3>, z.ZodLiteral<5>]>;
    points: z.ZodInt;
}, z.core.$strict>;
export type BracketRound = z.infer<typeof bracketRoundSchema>;
export declare const bracketSlotSchema: z.ZodObject<{
    id: z.ZodString;
    round: z.ZodString;
    top: z.ZodUnion<readonly [z.ZodObject<{
        position: z.ZodInt;
    }, z.core.$strict>, z.ZodObject<{
        winnerOf: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        loserOf: z.ZodString;
    }, z.core.$strict>]>;
    bottom: z.ZodUnion<readonly [z.ZodObject<{
        position: z.ZodInt;
    }, z.core.$strict>, z.ZodObject<{
        winnerOf: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        loserOf: z.ZodString;
    }, z.core.$strict>]>;
}, z.core.$strict>;
export type BracketSlot = z.infer<typeof bracketSlotSchema>;
export declare const bracketStageSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    kind: z.ZodLiteral<"bracket">;
    style: z.ZodEnum<{
        "single-elimination": "single-elimination";
        "double-elimination": "double-elimination";
    }>;
    teams: z.ZodInt;
    rounds: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        side: z.ZodEnum<{
            upper: "upper";
            lower: "lower";
            final: "final";
        }>;
        bestOf: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<3>, z.ZodLiteral<5>]>;
        points: z.ZodInt;
    }, z.core.$strict>>;
    slots: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        round: z.ZodString;
        top: z.ZodUnion<readonly [z.ZodObject<{
            position: z.ZodInt;
        }, z.core.$strict>, z.ZodObject<{
            winnerOf: z.ZodString;
        }, z.core.$strict>, z.ZodObject<{
            loserOf: z.ZodString;
        }, z.core.$strict>]>;
        bottom: z.ZodUnion<readonly [z.ZodObject<{
            position: z.ZodInt;
        }, z.core.$strict>, z.ZodObject<{
            winnerOf: z.ZodString;
        }, z.core.$strict>, z.ZodObject<{
            loserOf: z.ZodString;
        }, z.core.$strict>]>;
    }, z.core.$strict>>;
    bracketReset: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strict>;
export type BracketStage = z.infer<typeof bracketStageSchema>;
export declare const unpredictedStageSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    kind: z.ZodLiteral<"not-predicted">;
    teams: z.ZodInt;
    summary: z.ZodString;
}, z.core.$strict>;
export type UnpredictedStage = z.infer<typeof unpredictedStageSchema>;
export declare const stageSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    kind: z.ZodLiteral<"swiss">;
    teams: z.ZodInt;
    winsToFinish: z.ZodInt;
    lossesToFinish: z.ZodInt;
    rounds: z.ZodInt;
    bestOf: z.ZodObject<{
        decisive: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<3>, z.ZodLiteral<5>]>;
        other: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<3>, z.ZodLiteral<5>]>;
    }, z.core.$strict>;
    eliminationRound: z.ZodOptional<z.ZodObject<{
        records: z.ZodArray<z.ZodString>;
        bestOf: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<3>, z.ZodLiteral<5>]>;
        pairing: z.ZodEnum<{
            "higher-seed-picks-opponent": "higher-seed-picks-opponent";
            organizer: "organizer";
        }>;
    }, z.core.$strict>>;
    buckets: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        size: z.ZodInt;
        points: z.ZodInt;
        records: z.ZodArray<z.ZodString>;
        eliminationRound: z.ZodOptional<z.ZodEnum<{
            won: "won";
            lost: "lost";
        }>>;
        advances: z.ZodBoolean;
    }, z.core.$strict>>;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    kind: z.ZodLiteral<"gsl">;
    groups: z.ZodInt;
    bestOf: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<3>, z.ZodLiteral<5>]>;
    points: z.ZodObject<{
        first: z.ZodInt;
        second: z.ZodInt;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    kind: z.ZodLiteral<"round-robin">;
    groups: z.ZodInt;
    teamsPerGroup: z.ZodInt;
    advancePerGroup: z.ZodInt;
    bestOf: z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<3>, z.ZodLiteral<5>]>, z.ZodLiteral<2>]>;
    points: z.ZodObject<{
        perQualifier: z.ZodInt;
        groupWinner: z.ZodInt;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    kind: z.ZodLiteral<"bracket">;
    style: z.ZodEnum<{
        "single-elimination": "single-elimination";
        "double-elimination": "double-elimination";
    }>;
    teams: z.ZodInt;
    rounds: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        side: z.ZodEnum<{
            upper: "upper";
            lower: "lower";
            final: "final";
        }>;
        bestOf: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<3>, z.ZodLiteral<5>]>;
        points: z.ZodInt;
    }, z.core.$strict>>;
    slots: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        round: z.ZodString;
        top: z.ZodUnion<readonly [z.ZodObject<{
            position: z.ZodInt;
        }, z.core.$strict>, z.ZodObject<{
            winnerOf: z.ZodString;
        }, z.core.$strict>, z.ZodObject<{
            loserOf: z.ZodString;
        }, z.core.$strict>]>;
        bottom: z.ZodUnion<readonly [z.ZodObject<{
            position: z.ZodInt;
        }, z.core.$strict>, z.ZodObject<{
            winnerOf: z.ZodString;
        }, z.core.$strict>, z.ZodObject<{
            loserOf: z.ZodString;
        }, z.core.$strict>]>;
    }, z.core.$strict>>;
    bracketReset: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    kind: z.ZodLiteral<"not-predicted">;
    teams: z.ZodInt;
    summary: z.ZodString;
}, z.core.$strict>], "kind">;
export type Stage = z.infer<typeof stageSchema>;
export declare const roundConfigSchema: z.ZodObject<{
    stage: z.ZodString;
    lockMinutesBefore: z.ZodInt;
}, z.core.$strict>;
export type RoundConfig = z.infer<typeof roundConfigSchema>;
export declare const formatTemplateSchema: z.ZodObject<{
    id: z.ZodString;
    version: z.ZodInt;
    game: z.ZodEnum<{
        dota2: "dota2";
        cs2: "cs2";
        lol: "lol";
    }>;
    name: z.ZodString;
    reference: z.ZodObject<{
        event: z.ZodString;
        url: z.ZodURL;
        checkedOn: z.ZodISODate;
    }, z.core.$strict>;
    stages: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodLiteral<"swiss">;
        teams: z.ZodInt;
        winsToFinish: z.ZodInt;
        lossesToFinish: z.ZodInt;
        rounds: z.ZodInt;
        bestOf: z.ZodObject<{
            decisive: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<3>, z.ZodLiteral<5>]>;
            other: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<3>, z.ZodLiteral<5>]>;
        }, z.core.$strict>;
        eliminationRound: z.ZodOptional<z.ZodObject<{
            records: z.ZodArray<z.ZodString>;
            bestOf: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<3>, z.ZodLiteral<5>]>;
            pairing: z.ZodEnum<{
                "higher-seed-picks-opponent": "higher-seed-picks-opponent";
                organizer: "organizer";
            }>;
        }, z.core.$strict>>;
        buckets: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            size: z.ZodInt;
            points: z.ZodInt;
            records: z.ZodArray<z.ZodString>;
            eliminationRound: z.ZodOptional<z.ZodEnum<{
                won: "won";
                lost: "lost";
            }>>;
            advances: z.ZodBoolean;
        }, z.core.$strict>>;
    }, z.core.$strict>, z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodLiteral<"gsl">;
        groups: z.ZodInt;
        bestOf: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<3>, z.ZodLiteral<5>]>;
        points: z.ZodObject<{
            first: z.ZodInt;
            second: z.ZodInt;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodLiteral<"round-robin">;
        groups: z.ZodInt;
        teamsPerGroup: z.ZodInt;
        advancePerGroup: z.ZodInt;
        bestOf: z.ZodUnion<readonly [z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<3>, z.ZodLiteral<5>]>, z.ZodLiteral<2>]>;
        points: z.ZodObject<{
            perQualifier: z.ZodInt;
            groupWinner: z.ZodInt;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodLiteral<"bracket">;
        style: z.ZodEnum<{
            "single-elimination": "single-elimination";
            "double-elimination": "double-elimination";
        }>;
        teams: z.ZodInt;
        rounds: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            side: z.ZodEnum<{
                upper: "upper";
                lower: "lower";
                final: "final";
            }>;
            bestOf: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<3>, z.ZodLiteral<5>]>;
            points: z.ZodInt;
        }, z.core.$strict>>;
        slots: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            round: z.ZodString;
            top: z.ZodUnion<readonly [z.ZodObject<{
                position: z.ZodInt;
            }, z.core.$strict>, z.ZodObject<{
                winnerOf: z.ZodString;
            }, z.core.$strict>, z.ZodObject<{
                loserOf: z.ZodString;
            }, z.core.$strict>]>;
            bottom: z.ZodUnion<readonly [z.ZodObject<{
                position: z.ZodInt;
            }, z.core.$strict>, z.ZodObject<{
                winnerOf: z.ZodString;
            }, z.core.$strict>, z.ZodObject<{
                loserOf: z.ZodString;
            }, z.core.$strict>]>;
        }, z.core.$strict>>;
        bracketReset: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>, z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodLiteral<"not-predicted">;
        teams: z.ZodInt;
        summary: z.ZodString;
    }, z.core.$strict>], "kind">>;
    rounds: z.ZodObject<{
        groups: z.ZodOptional<z.ZodObject<{
            stage: z.ZodString;
            lockMinutesBefore: z.ZodInt;
        }, z.core.$strict>>;
        bracket: z.ZodObject<{
            stage: z.ZodString;
            lockMinutesBefore: z.ZodInt;
        }, z.core.$strict>;
    }, z.core.$strict>;
}, z.core.$strict>;
export type FormatTemplate = z.infer<typeof formatTemplateSchema>;
//# sourceMappingURL=schema.d.ts.map