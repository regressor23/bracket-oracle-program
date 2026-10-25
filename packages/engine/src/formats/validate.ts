import {
  formatTemplateSchema,
  type BracketStage,
  type FormatTemplate,
  type SlotSource,
  type Stage,
  type SwissStage,
} from './schema.js';

export interface FormatIssue {
  /** Dotted path into the template, for example "stages[2].slots[5].top". */
  path: string;
  message: string;
}

export type FormatValidation =
  { ok: true; template: FormatTemplate } | { ok: false; issues: FormatIssue[] };

/** Stage kinds the "Groups" round can predict. */
const GROUP_KINDS: ReadonlySet<Stage['kind']> = new Set(['swiss', 'gsl', 'round-robin']);

function formatRecord(wins: number, losses: number): string {
  return `${wins}-${losses}`;
}

function parseRecord(record: string): [number, number] {
  const [wins, losses] = record.split('-').map(Number);
  return [wins ?? 0, losses ?? 0];
}

/**
 * How many teams finish a Swiss stage on each record, when teams always play opponents with the
 * same record. Returns null when some record group has an odd number of teams, because then the
 * organizer's bye or cross-record pairing decides the split and the counts are not fixed.
 */
export function swissRecordDistribution(
  stage: Pick<SwissStage, 'teams' | 'winsToFinish' | 'lossesToFinish' | 'rounds'>,
): Map<string, number> | null {
  const { teams, winsToFinish: maxWins, lossesToFinish: maxLosses, rounds } = stage;
  let active = new Map<string, number>([[formatRecord(0, 0), teams]]);
  const finished = new Map<string, number>();
  const add = (map: Map<string, number>, key: string, count: number) =>
    map.set(key, (map.get(key) ?? 0) + count);

  for (let round = 1; round <= rounds && active.size > 0; round += 1) {
    const next = new Map<string, number>();
    for (const [key, count] of active) {
      if (count % 2 !== 0) return null;
      const [wins, losses] = parseRecord(key);
      for (const [w, l] of [
        [wins + 1, losses],
        [wins, losses + 1],
      ] as const) {
        const done = w === maxWins || l === maxLosses || round === rounds;
        add(done ? finished : next, formatRecord(w, l), count / 2);
      }
    }
    active = next;
  }
  // Fewer rounds than needed is caught by the caller; anything still active did not finish.
  for (const [key, count] of active) add(finished, key, count);

  return new Map(
    [...finished].sort(([a], [b]) => {
      const [aw, al] = parseRecord(a);
      const [bw, bl] = parseRecord(b);
      return bw - aw || al - bl;
    }),
  );
}

function checkSwiss(stage: SwissStage, at: string, issues: FormatIssue[]) {
  const push = (path: string, message: string) => issues.push({ path: `${at}${path}`, message });

  if (stage.rounds > stage.winsToFinish + stage.lossesToFinish - 1) {
    push('.rounds', 'no team can play this many rounds before reaching a finishing record');
  }
  const distribution = swissRecordDistribution(stage);
  if (!distribution) {
    push('.teams', 'some record group has an odd number of teams, so bucket sizes are not fixed');
    return;
  }

  const eliminationRecords = new Set(stage.eliminationRound?.records ?? []);
  for (const record of eliminationRecords) {
    if (!distribution.has(record)) {
      push('.eliminationRound.records', `no team can finish the Swiss rounds on ${record}`);
    }
  }
  const eliminationTeams = [...eliminationRecords].reduce(
    (sum, record) => sum + (distribution.get(record) ?? 0),
    0,
  );
  if (eliminationTeams % 2 !== 0) {
    push('.eliminationRound.records', 'the elimination round needs an even number of teams');
  }

  const seenIds = new Set<string>();
  const covered = new Map<string, number>();
  let totalSize = 0;

  stage.buckets.forEach((bucket, index) => {
    const path = `.buckets[${index}]`;
    if (seenIds.has(bucket.id)) push(`${path}.id`, `duplicate bucket id "${bucket.id}"`);
    seenIds.add(bucket.id);
    totalSize += bucket.size;

    if (bucket.eliminationRound && !stage.eliminationRound) {
      push(`${path}.eliminationRound`, 'this stage has no elimination round');
    }
    let expectedSize = 0;
    for (const record of bucket.records) {
      const count = distribution.get(record);
      if (count === undefined) {
        push(`${path}.records`, `no team can finish on ${record}`);
        continue;
      }
      const inElimination = eliminationRecords.has(record);
      if (inElimination !== Boolean(bucket.eliminationRound)) {
        push(
          `${path}.records`,
          inElimination
            ? `${record} plays the elimination round, so the bucket must say "won" or "lost"`
            : `${record} does not play the elimination round`,
        );
      }
      const key = inElimination ? `${record}/${bucket.eliminationRound ?? '?'}` : record;
      covered.set(key, (covered.get(key) ?? 0) + 1);
      expectedSize += inElimination ? 0 : count;
    }

    if (bucket.eliminationRound) {
      const coversAll = [...eliminationRecords].every((record) => bucket.records.includes(record));
      if (!coversAll) {
        push(`${path}.records`, 'an elimination-round bucket must list every elimination record');
      }
      expectedSize = eliminationTeams / 2;
    }
    if (bucket.size !== expectedSize) {
      push(`${path}.size`, `expected ${expectedSize} teams for ${bucket.records.join(', ')}`);
    }

    const [wins, losses] = parseRecord(bucket.records[0] ?? '0-0');
    const mustAdvance =
      bucket.eliminationRound === 'won' ||
      (!bucket.eliminationRound && wins === stage.winsToFinish);
    const mustExit =
      bucket.eliminationRound === 'lost' ||
      (!bucket.eliminationRound && losses === stage.lossesToFinish);
    if ((mustAdvance && !bucket.advances) || (mustExit && bucket.advances)) {
      push(`${path}.advances`, mustAdvance ? 'these teams advance' : 'these teams are eliminated');
    }
  });

  for (const record of distribution.keys()) {
    const keys = eliminationRecords.has(record) ? [`${record}/won`, `${record}/lost`] : [record];
    for (const key of keys) {
      const times = covered.get(key) ?? 0;
      if (times !== 1) {
        push('.buckets', `${key} must be in exactly one bucket, found ${times}`);
      }
    }
  }
  if (totalSize !== stage.teams) {
    push('.buckets', `bucket sizes add up to ${totalSize}, the stage has ${stage.teams} teams`);
  }
}

function describeSource(source: SlotSource): string {
  if ('position' in source) return `position ${source.position}`;
  if ('winnerOf' in source) return `winner of ${source.winnerOf}`;
  return `loser of ${source.loserOf}`;
}

function checkBracket(stage: BracketStage, at: string, issues: FormatIssue[]) {
  const push = (path: string, message: string) => issues.push({ path: `${at}${path}`, message });

  const roundIndex = new Map<string, number>();
  stage.rounds.forEach((round, index) => {
    if (roundIndex.has(round.id)) push(`.rounds[${index}].id`, `duplicate round id "${round.id}"`);
    roundIndex.set(round.id, index);
    if (stage.style === 'single-elimination' && round.side === 'lower') {
      push(`.rounds[${index}].side`, 'a single-elimination bracket has no lower bracket');
    }
  });
  const sideOf = (roundId: string) =>
    stage.rounds.find((round) => round.id === roundId)?.side ?? 'upper';

  const slotById = new Map<string, { index: number; round: string }>();
  const positions = new Map<number, number>();
  const winnerUses = new Map<string, number>();
  const loserUses = new Map<string, number>();

  stage.slots.forEach((slot, index) => {
    const path = `.slots[${index}]`;
    if (slotById.has(slot.id)) push(`${path}.id`, `duplicate slot id "${slot.id}"`);
    const ownRound = roundIndex.get(slot.round);
    if (ownRound === undefined) push(`${path}.round`, `unknown round "${slot.round}"`);
    const ownSide = sideOf(slot.round);

    const sources = [
      ['top', slot.top],
      ['bottom', slot.bottom],
    ] as const;
    for (const [field, source] of sources) {
      const sourcePath = `${path}.${field}`;
      if ('position' in source) {
        if (source.position > stage.teams) {
          push(sourcePath, `position ${source.position} is above the ${stage.teams} teams`);
        }
        positions.set(source.position, (positions.get(source.position) ?? 0) + 1);
        if (ownSide !== 'upper') push(sourcePath, 'teams can only start in the upper bracket');
        continue;
      }
      const from = 'winnerOf' in source ? source.winnerOf : source.loserOf;
      const earlier = slotById.get(from);
      if (!earlier) {
        push(sourcePath, `${describeSource(source)}: no earlier slot with this id`);
        continue;
      }
      if (earlier.round === slot.round) {
        push(sourcePath, `${describeSource(source)} comes from the same round`);
      }
      const fromSide = sideOf(earlier.round);
      if ('winnerOf' in source) {
        winnerUses.set(from, (winnerUses.get(from) ?? 0) + 1);
        const allowed = ownSide === 'final' ? fromSide !== 'final' : fromSide === ownSide;
        if (!allowed) push(sourcePath, `the ${fromSide} bracket cannot feed the ${ownSide} side`);
      } else {
        loserUses.set(from, (loserUses.get(from) ?? 0) + 1);
        if (stage.style === 'single-elimination') {
          push(sourcePath, 'single elimination never moves a loser on');
        } else if (fromSide !== 'upper' || ownSide !== 'lower') {
          push(sourcePath, 'only upper-bracket losers move, and only to the lower bracket');
        }
      }
    }
    const top = 'position' in slot.top ? null : Object.values(slot.top)[0];
    const bottom = 'position' in slot.bottom ? null : Object.values(slot.bottom)[0];
    if (top !== null && top === bottom) push(path, 'both teams come from the same slot');

    slotById.set(slot.id, { index, round: slot.round });
  });

  for (let position = 1; position <= stage.teams; position += 1) {
    const times = positions.get(position) ?? 0;
    if (times !== 1) push('.slots', `position ${position} must start exactly once, found ${times}`);
  }
  for (const [id, times] of [...winnerUses, ...loserUses]) {
    if (times > 1) push('.slots', `the result of ${id} is used ${times} times`);
  }

  const champions = stage.slots.filter((slot) => !winnerUses.has(slot.id));
  if (champions.length !== 1) {
    push('.slots', `exactly one slot must decide the champion, found ${champions.length}`);
  }
  stage.slots.forEach((slot, index) => {
    const side = sideOf(slot.round);
    const isChampionSlot = !winnerUses.has(slot.id);
    if (isChampionSlot !== (side === 'final')) {
      push(
        `.slots[${index}]`,
        isChampionSlot
          ? 'the slot that decides the champion belongs in a final round'
          : 'only the slot that decides the champion belongs in a final round',
      );
    }
    if (stage.style === 'double-elimination' && side === 'upper' && !loserUses.has(slot.id)) {
      push(`.slots[${index}]`, 'an upper-bracket loser must drop to the lower bracket');
    }
  });
  if (stage.bracketReset && stage.style !== 'double-elimination') {
    push('.bracketReset', 'only a double-elimination grand final can be reset');
  }
}

/** Checks that need the whole template; run after the Zod schema accepts the shape. */
export function checkTemplate(template: FormatTemplate): FormatIssue[] {
  const issues: FormatIssue[] = [];
  const stageIndex = new Map<string, number>();

  template.stages.forEach((stage, index) => {
    const at = `stages[${index}]`;
    if (stageIndex.has(stage.id)) issues.push({ path: `${at}.id`, message: 'duplicate stage id' });
    stageIndex.set(stage.id, index);
    if (stage.kind === 'swiss') checkSwiss(stage, at, issues);
    if (stage.kind === 'bracket') checkBracket(stage, at, issues);
    if (stage.kind === 'round-robin' && stage.advancePerGroup >= stage.teamsPerGroup) {
      issues.push({ path: `${at}.advancePerGroup`, message: 'someone has to be eliminated' });
    }
  });

  const { groups, bracket } = template.rounds;
  const bracketIndex = stageIndex.get(bracket.stage);
  const bracketStage = bracketIndex === undefined ? undefined : template.stages[bracketIndex];
  if (!bracketStage) {
    issues.push({ path: 'rounds.bracket.stage', message: `unknown stage "${bracket.stage}"` });
  } else if (bracketStage.kind !== 'bracket') {
    issues.push({ path: 'rounds.bracket.stage', message: 'the Bracket round predicts a bracket' });
  }
  if (groups) {
    const groupsIndex = stageIndex.get(groups.stage);
    const groupsStage = groupsIndex === undefined ? undefined : template.stages[groupsIndex];
    if (!groupsStage) {
      issues.push({ path: 'rounds.groups.stage', message: `unknown stage "${groups.stage}"` });
    } else if (!GROUP_KINDS.has(groupsStage.kind)) {
      issues.push({
        path: 'rounds.groups.stage',
        message: 'the Groups round predicts a Swiss, GSL or round-robin stage',
      });
    } else if (bracketIndex !== undefined && (groupsIndex ?? 0) > bracketIndex) {
      issues.push({ path: 'rounds.groups.stage', message: 'groups must come before the bracket' });
    }
  }

  const predicted = new Set([bracket.stage, groups?.stage]);
  template.stages.forEach((stage, index) => {
    if (stage.kind !== 'not-predicted' && !predicted.has(stage.id)) {
      issues.push({
        path: `stages[${index}].kind`,
        message: 'no round predicts this stage; describe it as "not-predicted"',
      });
    }
  });

  return issues;
}

/** Parses unknown JSON as a format template and runs every check. */
export function validateFormat(input: unknown): FormatValidation {
  const parsed = formatTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path:
          issue.path
            .map((part, i) =>
              typeof part === 'number' ? `[${part}]` : `${i === 0 ? '' : '.'}${String(part)}`,
            )
            .join('') || '<root>',
        message: issue.message,
      })),
    };
  }
  const issues = checkTemplate(parsed.data);
  return issues.length === 0 ? { ok: true, template: parsed.data } : { ok: false, issues };
}
