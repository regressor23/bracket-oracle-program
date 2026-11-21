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
export const PREDICTION_FORMAT = 1;
const ID = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,62}[A-Za-z0-9])?$/;
export const entityIdSchema = z
    .string()
    .regex(ID, 'use 1-64 letters, digits, "_", "." or "-", starting and ending with a letter or digit')
    .describe('An id the platform publishes: a tournament, a contest or a team.');
const slug = z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'use lowercase letters, digits and single hyphens');
const groupLabel = z
    .string()
    .regex(/^[A-Za-z0-9]{1,16}$/, 'use 1-16 letters or digits')
    .describe('Group label as the platform publishes it, for example "A".');
export const swissPicksSchema = z.strictObject({
    kind: z.literal('swiss'),
    buckets: z
        .record(entityIdSchema, slug)
        .describe('The bucket id the player put each team in. Teams left out are not picked yet.'),
});
export const gslPicksSchema = z.strictObject({
    kind: z.literal('gsl'),
    groups: z
        .record(groupLabel, z.strictObject({ first: entityIdSchema.optional(), second: entityIdSchema.optional() }))
        .describe('The teams the player expects to finish first and second in each group.'),
});
export const roundRobinPicksSchema = z.strictObject({
    kind: z.literal('round-robin'),
    groups: z
        .record(groupLabel, z.strictObject({
        qualifiers: z.array(entityIdSchema).max(20),
        winner: entityIdSchema.optional().describe('The group winner; one of the qualifiers.'),
    }))
        .describe('The teams the player expects to advance from each group, and its winner.'),
});
export const bracketPickSchema = z.strictObject({
    winner: entityIdSchema,
    score: z
        .tuple([z.int().min(1).max(3), z.int().min(0).max(2)])
        .optional()
        .describe("Exact series score, the winner's maps first, for example [2, 1]. Bo3 and Bo5 only."),
});
export const bracketPicksSchema = z.strictObject({
    kind: z.literal('bracket'),
    slots: z
        .record(slug, bracketPickSchema)
        .describe('The winner of each slot, by slot id. Slots left out are not picked yet.'),
});
export const picksSchema = z.discriminatedUnion('kind', [
    swissPicksSchema,
    gslPicksSchema,
    roundRobinPicksSchema,
    bracketPicksSchema,
]);
export const roundSchema = z
    .enum(['groups', 'bracket'])
    .describe('The product round: "groups" predicts the last stage before the playoffs.');
export const predictionSchema = z.strictObject({
    format: z.literal(PREDICTION_FORMAT),
    tournament: entityIdSchema,
    contest: entityIdSchema.describe('Each round of a tournament is its own contest.'),
    round: roundSchema,
    template: z
        .strictObject({ id: slug, version: z.int().min(1) })
        .describe('The format template, and its version, the round is scored with.'),
    revision: z
        .int()
        .min(1)
        .describe('Save number of this prediction: 1 for the first save, then one more each time.'),
    picks: picksSchema,
    tiebreak: z
        .strictObject({
        maps: z.int().min(0).max(1_000).describe('Total maps the player expects in the round.'),
    })
        .nullable()
        .describe('Null while the player has not answered; such a prediction ranks last among ties.'),
});
/**
 * The teams of the predicted stage, as the platform publishes them when the round opens. Picks
 * are checked against them; a team that is not listed (for example one replaced before its first
 * series) makes the pick stale.
 */
export const stageParticipantsSchema = z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('swiss'), teams: z.array(entityIdSchema).min(2) }),
    z.strictObject({
        kind: z.literal('gsl'),
        groups: z.record(groupLabel, z.array(entityIdSchema).length(4)),
    }),
    z.strictObject({
        kind: z.literal('round-robin'),
        groups: z.record(groupLabel, z.array(entityIdSchema).min(3)),
    }),
    z.strictObject({
        kind: z.literal('bracket'),
        positions: z
            .array(entityIdSchema.nullable())
            .min(2)
            .describe('Team ids for positions 1..teams, top of the bracket first.'),
    }),
]);
//# sourceMappingURL=schema.js.map