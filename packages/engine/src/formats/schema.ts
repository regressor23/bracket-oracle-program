import { z } from 'zod';

/**
 * Format templates: the shape of every stage a tournament can have, which stages players
 * predict, and how many points each pick is worth. Templates are data, so anyone can check that
 * a pool was scored with the published rules. Structural rules live here; rules that need the
 * whole template (slot graph, Swiss records, bucket sizes) live in `validate.ts`.
 *
 * Descriptions go through `.describe()` so they also land in the published JSON Schema.
 */

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'use lowercase letters, digits and single hyphens');
const label = z.string().trim().min(1).max(80);
const points = z.int().min(0).max(1_000);
const record = z
  .string()
  .regex(/^\d{1,2}-\d{1,2}$/, 'use "wins-losses", for example "3-1"')
  .describe('Swiss record as "wins-losses", for example "3-1".');

export const gameSchema = z.enum(['dota2', 'cs2', 'lol']);
export type Game = z.infer<typeof gameSchema>;

export const bestOfSchema = z
  .union([z.literal(1), z.literal(3), z.literal(5)])
  .describe('Series length the scoring rules know: Bo1, Bo3 or Bo5.');
export type BestOf = z.infer<typeof bestOfSchema>;

export const swissBucketSchema = z.strictObject({
  id: slug,
  label,
  size: z.int().min(1).describe('How many teams the player puts in this bucket.'),
  points: points.describe('Points for each team in the bucket that actually finished there.'),
  records: z.array(record).min(1).describe('Final Swiss records that land a team here.'),
  eliminationRound: z
    .enum(['won', 'lost'])
    .optional()
    .describe('For stages with an elimination round: whether the team won or lost it.'),
  advances: z.boolean().describe('Whether finishing here sends the team to the next stage.'),
});
export type SwissBucket = z.infer<typeof swissBucketSchema>;

export const swissStageSchema = z.strictObject({
  id: slug,
  name: label,
  kind: z.literal('swiss'),
  teams: z.int().min(4).max(64),
  winsToFinish: z.int().min(1).describe('A team stops playing once it has this many wins.'),
  lossesToFinish: z.int().min(1).describe('A team stops playing once it has this many losses.'),
  rounds: z.int().min(1).describe('Every team stops after this many rounds.'),
  bestOf: z
    .strictObject({ decisive: bestOfSchema, other: bestOfSchema })
    .describe(
      'Series length for decisive series (a win advances or a loss eliminates) and others.',
    ),
  eliminationRound: z
    .strictObject({
      records: z
        .array(record)
        .min(1)
        .describe('Records that play the elimination round; each series pairs two such teams.'),
      bestOf: bestOfSchema,
      pairing: z.enum(['higher-seed-picks-opponent', 'organizer']),
    })
    .optional()
    .describe('Extra series after the Swiss rounds, as at The International.'),
  buckets: z.array(swissBucketSchema).min(2),
});
export type SwissStage = z.infer<typeof swissStageSchema>;

export const gslStageSchema = z
  .strictObject({
    id: slug,
    name: label,
    kind: z.literal('gsl'),
    groups: z.int().min(1).max(16),
    bestOf: bestOfSchema,
    points: z
      .strictObject({ first: points, second: points })
      .describe('Points for naming the team that finishes first, and second, in each group.'),
  })
  .describe('Groups of four: two openers, winners and elimination matches, then a decider.');
export type GslStage = z.infer<typeof gslStageSchema>;

export const roundRobinStageSchema = z.strictObject({
  id: slug,
  name: label,
  kind: z.literal('round-robin'),
  groups: z.int().min(1).max(16),
  teamsPerGroup: z.int().min(3).max(20),
  advancePerGroup: z.int().min(1),
  bestOf: z.union([bestOfSchema, z.literal(2)]),
  points: z
    .strictObject({ perQualifier: points, groupWinner: points })
    .describe('Points for each team that advances, plus a bonus for the group winner.'),
});
export type RoundRobinStage = z.infer<typeof roundRobinStageSchema>;

export const slotSourceSchema = z
  .union([
    z.strictObject({ position: z.int().min(1) }),
    z.strictObject({ winnerOf: slug }),
    z.strictObject({ loserOf: slug }),
  ])
  .describe('Where a team in a slot comes from: a starting position, or an earlier slot.');
export type SlotSource = z.infer<typeof slotSourceSchema>;

export const bracketRoundSchema = z.strictObject({
  id: slug,
  name: label,
  side: z.enum(['upper', 'lower', 'final']),
  bestOf: bestOfSchema,
  points: points.describe('Points for naming the winner of each series in this round.'),
});
export type BracketRound = z.infer<typeof bracketRoundSchema>;

export const bracketSlotSchema = z.strictObject({
  id: slug,
  round: slug,
  top: slotSourceSchema,
  bottom: slotSourceSchema,
});
export type BracketSlot = z.infer<typeof bracketSlotSchema>;

export const bracketStageSchema = z.strictObject({
  id: slug,
  name: label,
  kind: z.literal('bracket'),
  style: z.enum(['single-elimination', 'double-elimination']),
  teams: z
    .int()
    .min(2)
    .max(64)
    .describe(
      'Starting positions are numbered 1..teams from the top of the bracket down; the ' +
        "organizer's seeding or draw fills them when the Bracket round opens.",
    ),
  rounds: z
    .array(bracketRoundSchema)
    .min(1)
    .describe('Rounds in display order: upper bracket, lower bracket, then the final.'),
  slots: z
    .array(bracketSlotSchema)
    .min(1)
    .describe('Slots in playing order; a slot only refers to slots listed before it.'),
  bracketReset: z
    .boolean()
    .optional()
    .describe('Grand final with a bracket reset. It is still one slot, see the rules.'),
});
export type BracketStage = z.infer<typeof bracketStageSchema>;

export const unpredictedStageSchema = z
  .strictObject({
    id: slug,
    name: label,
    kind: z.literal('not-predicted'),
    teams: z.int().min(2),
    summary: z.string().trim().min(1).max(300),
  })
  .describe('A stage players do not predict, kept so the template describes the whole event.');
export type UnpredictedStage = z.infer<typeof unpredictedStageSchema>;

export const stageSchema = z.discriminatedUnion('kind', [
  swissStageSchema,
  gslStageSchema,
  roundRobinStageSchema,
  bracketStageSchema,
  unpredictedStageSchema,
]);
export type Stage = z.infer<typeof stageSchema>;

export const roundConfigSchema = z
  .strictObject({
    stage: slug,
    lockMinutesBefore: z
      .int()
      .min(0)
      .max(24 * 60)
      .describe('Lock this many minutes before the first scheduled match of the stage.'),
  })
  .describe('One of the two product rounds of a tournament: "Groups" or "Bracket".');
export type RoundConfig = z.infer<typeof roundConfigSchema>;

export const formatTemplateSchema = z.strictObject({
  id: slug,
  version: z.int().min(1).describe('Bumped whenever stages, slots or points change.'),
  game: gameSchema,
  name: label,
  reference: z
    .strictObject({
      event: label,
      url: z.url({ protocol: /^https$/ }),
      checkedOn: z.iso.date(),
    })
    .describe('The event this template was checked against.'),
  stages: z.array(stageSchema).min(1).describe('Stages in the order they are played.'),
  rounds: z.strictObject({
    groups: roundConfigSchema.optional(),
    bracket: roundConfigSchema,
  }),
});
export type FormatTemplate = z.infer<typeof formatTemplateSchema>;
