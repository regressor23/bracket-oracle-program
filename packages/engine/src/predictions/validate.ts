import type { CanonicalValue } from '../canonical.js';
import { roundStage } from '../formats/points.js';
import { resolveBracket } from '../formats/resolve.js';
import type { BestOf, BracketStage, FormatTemplate, Stage } from '../formats/schema.js';
import { getFormatTemplate } from '../formats/templates.js';
import { hashCanonical } from '../hash.js';
import {
  predictionSchema,
  type BracketPicks,
  type GslPicks,
  type Prediction,
  type RoundRobinPicks,
  type StageParticipants,
  type SwissPicks,
} from './schema.js';

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

const pathOf = (path: readonly PropertyKey[]) =>
  path.map((p) => (typeof p === 'number' ? `[${p}]` : String(p))).join('.');

/** Valid exact scores, winner first, for a series length. */
export function exactScores(bestOf: BestOf): [number, number][] {
  if (bestOf === 1) return [];
  const need = Math.ceil(bestOf / 2);
  return Array.from({ length: need }, (_, lost) => [need, lost] as [number, number]);
}

interface Found {
  issues: PredictionIssue[];
  stale: string[];
  missing: string[];
}

function checkSwiss(
  stage: Extract<Stage, { kind: 'swiss' }>,
  picks: SwissPicks,
  participants: StageParticipants | undefined,
  found: Found,
): void {
  const sizes = new Map(stage.buckets.map((b) => [b.id, b.size]));
  const counts = new Map<string, number>();
  for (const [team, bucket] of Object.entries(picks.buckets)) {
    if (!sizes.has(bucket)) {
      found.issues.push({ path: `picks.buckets.${team}`, message: `unknown bucket "${bucket}"` });
      continue;
    }
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  for (const [bucket, count] of counts) {
    const size = sizes.get(bucket)!;
    if (count > size) {
      found.issues.push({
        path: 'picks.buckets',
        message: `bucket "${bucket}" holds ${count} teams, it has room for ${size}`,
      });
    }
  }
  if (participants?.kind !== 'swiss') return;
  const teams = new Set(participants.teams);
  for (const team of Object.keys(picks.buckets)) {
    if (!teams.has(team)) found.stale.push(`picks.buckets.${team}`);
  }
  for (const team of participants.teams) {
    if (!(team in picks.buckets)) found.missing.push(`picks.buckets.${team}`);
  }
}

function checkGsl(
  stage: Extract<Stage, { kind: 'gsl' }>,
  picks: GslPicks,
  participants: StageParticipants | undefined,
  found: Found,
): void {
  const labels = Object.keys(picks.groups);
  if (labels.length > stage.groups) {
    found.issues.push({
      path: 'picks.groups',
      message: `${labels.length} groups picked, the stage has ${stage.groups}`,
    });
  }
  for (const [label, group] of Object.entries(picks.groups)) {
    if (group.first !== undefined && group.first === group.second) {
      found.issues.push({
        path: `picks.groups.${label}`,
        message: `${group.first} cannot finish both first and second`,
      });
    }
  }
  if (participants?.kind !== 'gsl') return;
  for (const [label, group] of Object.entries(picks.groups)) {
    const teams = participants.groups[label];
    if (!teams) {
      found.issues.push({ path: `picks.groups.${label}`, message: `unknown group "${label}"` });
      continue;
    }
    for (const place of ['first', 'second'] as const) {
      const team = group[place];
      if (team !== undefined && !teams.includes(team)) {
        found.stale.push(`picks.groups.${label}.${place}`);
      }
    }
  }
  for (const label of Object.keys(participants.groups)) {
    for (const place of ['first', 'second'] as const) {
      if (picks.groups[label]?.[place] === undefined) {
        found.missing.push(`picks.groups.${label}.${place}`);
      }
    }
  }
}

function checkRoundRobin(
  stage: Extract<Stage, { kind: 'round-robin' }>,
  picks: RoundRobinPicks,
  participants: StageParticipants | undefined,
  found: Found,
): void {
  const labels = Object.keys(picks.groups);
  if (labels.length > stage.groups) {
    found.issues.push({
      path: 'picks.groups',
      message: `${labels.length} groups picked, the stage has ${stage.groups}`,
    });
  }
  for (const [label, group] of Object.entries(picks.groups)) {
    const at = `picks.groups.${label}`;
    if (new Set(group.qualifiers).size !== group.qualifiers.length) {
      found.issues.push({ path: `${at}.qualifiers`, message: 'a team is listed twice' });
    }
    if (group.qualifiers.length > stage.advancePerGroup) {
      found.issues.push({
        path: `${at}.qualifiers`,
        message: `${group.qualifiers.length} qualifiers picked, ${stage.advancePerGroup} advance`,
      });
    }
    if (group.winner !== undefined && !group.qualifiers.includes(group.winner)) {
      found.issues.push({
        path: `${at}.winner`,
        message: `the group winner ${group.winner} must be one of the qualifiers`,
      });
    }
  }
  if (participants?.kind !== 'round-robin') return;
  for (const [label, group] of Object.entries(picks.groups)) {
    const teams = participants.groups[label];
    if (!teams) {
      found.issues.push({ path: `picks.groups.${label}`, message: `unknown group "${label}"` });
      continue;
    }
    group.qualifiers.forEach((team, i) => {
      if (!teams.includes(team)) found.stale.push(`picks.groups.${label}.qualifiers[${i}]`);
    });
    if (group.winner !== undefined && !teams.includes(group.winner)) {
      found.stale.push(`picks.groups.${label}.winner`);
    }
  }
  for (const label of Object.keys(participants.groups)) {
    const group = picks.groups[label];
    if ((group?.qualifiers.length ?? 0) < stage.advancePerGroup) {
      found.missing.push(`picks.groups.${label}.qualifiers`);
    }
    if (group?.winner === undefined) found.missing.push(`picks.groups.${label}.winner`);
  }
}

function checkBracket(
  stage: BracketStage,
  picks: BracketPicks,
  participants: StageParticipants | undefined,
  found: Found,
): void {
  const rounds = new Map(stage.rounds.map((r) => [r.id, r]));
  const slots = new Map(stage.slots.map((s) => [s.id, s]));
  for (const [slotId, pick] of Object.entries(picks.slots)) {
    const slot = slots.get(slotId);
    if (!slot) {
      found.issues.push({ path: `picks.slots.${slotId}`, message: `unknown slot "${slotId}"` });
      continue;
    }
    if (pick.score === undefined) continue;
    const bestOf = rounds.get(slot.round)!.bestOf;
    const valid = exactScores(bestOf).some(
      ([w, l]) => w === pick.score![0] && l === pick.score![1],
    );
    if (!valid) {
      found.issues.push({
        path: `picks.slots.${slotId}.score`,
        message:
          bestOf === 1
            ? 'a Bo1 has no exact score to pick'
            : `${pick.score.join('-')} does not end a Bo${bestOf}`,
      });
    }
  }
  if (participants?.kind !== 'bracket') return;
  if (participants.positions.length !== stage.teams) {
    found.issues.push({
      path: 'participants.positions',
      message: `${participants.positions.length} positions given, the bracket has ${stage.teams}`,
    });
    return;
  }
  const winners = Object.fromEntries(
    Object.entries(picks.slots)
      .filter(([slotId]) => slots.has(slotId))
      .map(([slotId, pick]) => [slotId, pick.winner]),
  );
  const resolved = resolveBracket(stage, participants.positions, winners);
  found.stale.push(...resolved.stalePicks.map((slotId) => `picks.slots.${slotId}`));
  for (const slot of stage.slots) {
    if (!(slot.id in picks.slots)) found.missing.push(`picks.slots.${slot.id}`);
  }
}

/** Validates, hashes and reports on a prediction document. Never throws on bad input. */
export function checkPrediction(
  input: unknown,
  options: PredictionCheckOptions = {},
): PredictionCheck {
  const parsed = predictionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      prediction: null,
      hash: null,
      issues: parsed.error.issues.map((i) => ({ path: pathOf(i.path), message: i.message })),
      stale: [],
      missing: [],
      complete: null,
    };
  }
  const prediction = parsed.data;
  const hash = hashCanonical(prediction as unknown as CanonicalValue);
  const found: Found = { issues: [], stale: [], missing: [] };
  const done = (): PredictionCheck => ({
    ok: found.issues.length === 0,
    prediction,
    hash,
    issues: found.issues,
    stale: found.stale,
    missing: found.missing,
    complete: options.participants && found.issues.length === 0 ? found.missing.length === 0 : null,
  });

  if (options.contest !== undefined && prediction.contest !== options.contest) {
    found.issues.push({
      path: 'contest',
      message: `the prediction is for contest ${prediction.contest}, not ${options.contest}`,
    });
  }
  const template = options.template ?? getFormatTemplate(prediction.template.id);
  if (!template) {
    found.issues.push({
      path: 'template.id',
      message: `unknown format template "${prediction.template.id}"`,
    });
    return done();
  }
  if (template.id !== prediction.template.id || template.version !== prediction.template.version) {
    found.issues.push({
      path: 'template',
      message: `the prediction uses ${prediction.template.id} v${prediction.template.version}, the round uses ${template.id} v${template.version}`,
    });
    return done();
  }
  const stage = roundStage(template, prediction.round);
  if (!stage) {
    found.issues.push({
      path: 'round',
      message: `${template.id} has no ${prediction.round} round`,
    });
    return done();
  }
  if (stage.kind !== prediction.picks.kind) {
    found.issues.push({
      path: 'picks.kind',
      message: `the ${prediction.round} round predicts a ${stage.kind} stage, not ${prediction.picks.kind}`,
    });
    return done();
  }
  if (options.participants && options.participants.kind !== stage.kind) {
    found.issues.push({
      path: 'participants.kind',
      message: `the stage is ${stage.kind}, the participants are for ${options.participants.kind}`,
    });
    return done();
  }

  const { picks } = prediction;
  const participants = options.participants;
  if (stage.kind === 'swiss' && picks.kind === 'swiss')
    checkSwiss(stage, picks, participants, found);
  if (stage.kind === 'gsl' && picks.kind === 'gsl') checkGsl(stage, picks, participants, found);
  if (stage.kind === 'round-robin' && picks.kind === 'round-robin') {
    checkRoundRobin(stage, picks, participants, found);
  }
  if (stage.kind === 'bracket' && picks.kind === 'bracket') {
    checkBracket(stage, picks, participants, found);
  }
  if (participants && prediction.tiebreak === null) found.missing.push('tiebreak');
  return done();
}

/** How many picks the document makes, counted the way `pickCount` counts a full prediction. */
export function picksMade(picks: Prediction['picks']): number {
  switch (picks.kind) {
    case 'swiss':
      return Object.keys(picks.buckets).length;
    case 'gsl':
      return Object.values(picks.groups).reduce(
        (sum, g) => sum + (g.first === undefined ? 0 : 1) + (g.second === undefined ? 0 : 1),
        0,
      );
    case 'round-robin':
      return Object.values(picks.groups).reduce(
        (sum, g) => sum + g.qualifiers.length + (g.winner === undefined ? 0 : 1),
        0,
      );
    case 'bracket':
      return Object.keys(picks.slots).length;
  }
}

/** The SHA-256 of a prediction's canonical JSON, the value the wallet signs. */
export function predictionHash(prediction: Prediction): string {
  return hashCanonical(prediction as unknown as CanonicalValue);
}
