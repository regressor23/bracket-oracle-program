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

type Winner = { winner: string; loser: string } | { draw: true } | null;

/** Decides one series. `bestOf` 2 allows a 1-1 draw. */
function decide(result: SeriesResult, bestOf: number, at: string, issues: OutcomeIssue[]): Winner {
  const { team1, team2, score1, score2 } = result;
  if (team1 === team2) {
    issues.push({ at, message: `${team1} cannot play itself` });
    return null;
  }
  if (![score1, score2].every((s) => Number.isInteger(s) && s >= 0)) {
    issues.push({ at, message: `scores must be whole numbers from 0, got ${score1}-${score2}` });
    return null;
  }
  if (result.winner !== undefined) {
    if (result.winner !== team1 && result.winner !== team2) {
      issues.push({ at, message: `winner ${result.winner} is not ${team1} or ${team2}` });
      return null;
    }
    const loser = result.winner === team1 ? team2 : team1;
    if (!result.forfeit) {
      const [won, lost] = result.winner === team1 ? [score1, score2] : [score2, score1];
      if (won <= lost) {
        issues.push({ at, message: `winner ${result.winner} has the lower score ${won}-${lost}` });
        return null;
      }
    }
    return { winner: result.winner, loser };
  }
  if (result.forfeit) {
    issues.push({ at, message: 'a forfeit needs the winner' });
    return null;
  }
  if (score1 === score2) {
    if (bestOf === 2 && score1 === 1) return { draw: true };
    issues.push({ at, message: `${score1}-${score2} does not finish a Bo${bestOf}` });
    return null;
  }
  const need = bestOf === 2 ? 2 : Math.ceil(bestOf / 2);
  const [won, lost] = score1 > score2 ? [score1, score2] : [score2, score1];
  if (won !== need || lost >= need) {
    issues.push({ at, message: `${score1}-${score2} does not finish a Bo${bestOf}` });
    return null;
  }
  return score1 > score2 ? { winner: team1, loser: team2 } : { winner: team2, loser: team1 };
}

const sameTeams = (result: SeriesResult, a: string, b: string) =>
  (result.team1 === a && result.team2 === b) || (result.team1 === b && result.team2 === a);

// ---------------------------------------------------------------------------------------------
// Brackets
// ---------------------------------------------------------------------------------------------

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

/** Places for the losers of each eliminating round, from the bracket's shape alone. */
function eliminationPlaces(stage: BracketStage): Map<string, { from: number; to: number }> {
  const dropsLoser = (slotId: string) =>
    stage.slots.some(
      (s) =>
        ('loserOf' in s.top && s.top.loserOf === slotId) ||
        ('loserOf' in s.bottom && s.bottom.loserOf === slotId),
    );
  const lastIndex = new Map<string, number>();
  const count = new Map<string, number>();
  stage.slots.forEach((slot, index) => {
    if (dropsLoser(slot.id)) return;
    lastIndex.set(slot.round, index);
    count.set(slot.round, (count.get(slot.round) ?? 0) + 1);
  });
  const rounds = [...lastIndex.keys()].sort((a, b) => lastIndex.get(b)! - lastIndex.get(a)!);
  const places = new Map<string, { from: number; to: number }>();
  let next = 2;
  for (const round of rounds) {
    const n = count.get(round)!;
    places.set(round, { from: next, to: next + n - 1 });
    next += n;
  }
  return places;
}

export function bracketOutcome(stage: BracketStage, results: BracketResults): BracketOutcome {
  const issues: OutcomeIssue[] = [];
  const { positions } = results;
  if (positions.length > stage.teams) {
    issues.push({
      at: 'positions',
      message: `${positions.length} positions for ${stage.teams} teams`,
    });
  }
  const seen = new Set<string>();
  for (const team of positions) {
    if (team === null) continue;
    if (seen.has(team)) issues.push({ at: 'positions', message: `${team} is placed twice` });
    seen.add(team);
  }
  const knownSlots = new Set(stage.slots.map((s) => s.id));
  for (const id of Object.keys(results.series)) {
    if (!knownSlots.has(id)) issues.push({ at: id, message: 'no such slot in this bracket' });
  }

  const outcomes = new Map<string, BracketSlotOutcome>();
  const teamFrom = (source: BracketStage['slots'][number]['top']): string | null => {
    if ('position' in source) return positions[source.position - 1] ?? null;
    if ('winnerOf' in source) return outcomes.get(source.winnerOf)?.winner ?? null;
    return outcomes.get(source.loserOf)?.loser ?? null;
  };
  const lastSlot = stage.slots.at(-1)!;

  for (const slot of stage.slots) {
    const top = teamFrom(slot.top);
    const bottom = teamFrom(slot.bottom);
    const outcome: BracketSlotOutcome = {
      id: slot.id,
      round: slot.round,
      top,
      bottom,
      winner: null,
      loser: null,
      score: null,
      forfeit: false,
    };
    outcomes.set(slot.id, outcome);

    const raw = results.series[slot.id];
    const list: readonly SeriesResult[] =
      raw === undefined ? [] : Array.isArray(raw) ? raw : [raw as SeriesResult];
    if (list.length === 0) continue;
    if (top === null || bottom === null) {
      issues.push({ at: slot.id, message: 'has a result but its teams are not known yet' });
      continue;
    }
    const bestOf = stage.rounds.find((r) => r.id === slot.round)?.bestOf ?? 3;
    const reset = stage.bracketReset === true && slot.id === lastSlot.id;
    if (list.length > (reset ? 2 : 1)) {
      issues.push({ at: slot.id, message: `${list.length} series for one slot` });
      continue;
    }

    let decided: { winner: string; loser: string; result: SeriesResult } | null = null;
    for (const [index, result] of list.entries()) {
      const at = list.length > 1 ? `${slot.id} (series ${index + 1})` : slot.id;
      if (!sameTeams(result, top, bottom)) {
        issues.push({
          at,
          message: `result is ${result.team1} vs ${result.team2}, the slot holds ${top} vs ${bottom}`,
        });
        decided = null;
        break;
      }
      const winner = decide(result, bestOf, at, issues);
      if (winner === null || 'draw' in winner) {
        if (winner !== null) issues.push({ at, message: 'a bracket series cannot end in a draw' });
        decided = null;
        break;
      }
      decided = { ...winner, result };
    }
    if (decided === null) continue;

    if (reset) {
      // The upper-bracket finalist (top) wins the title with one series; the lower-bracket
      // finalist has to win twice. The slot is decided by the deciding series.
      if (list.length === 1 && decided.winner === bottom) continue;
      if (list.length === 2) {
        const first = decide(list[0]!, bestOf, slot.id, []);
        if (first !== null && !('draw' in first) && first.winner === top) {
          issues.push({
            at: slot.id,
            message: 'a reset series after the upper-bracket finalist already won',
          });
          continue;
        }
      }
    }

    const { result } = decided;
    outcome.winner = decided.winner;
    outcome.loser = decided.loser;
    outcome.forfeit = result.forfeit === true;
    outcome.score =
      result.team1 === top ? [result.score1, result.score2] : [result.score2, result.score1];
  }

  const slots = [...outcomes.values()];
  const champion = outcomes.get(lastSlot.id)?.winner ?? null;
  const places = eliminationPlaces(stage);
  const placements: Placement[] = [];
  if (champion !== null) placements.push({ team: champion, from: 1, to: 1 });
  const byRound = [...places.entries()];
  for (const [round, range] of byRound) {
    for (const slot of slots) {
      if (slot.round !== round || slot.loser === null) continue;
      const dropsLoser = stage.slots.some(
        (s) =>
          ('loserOf' in s.top && s.top.loserOf === slot.id) ||
          ('loserOf' in s.bottom && s.bottom.loserOf === slot.id),
      );
      if (!dropsLoser) placements.push({ team: slot.loser, ...range });
    }
  }

  return {
    slots,
    champion,
    placements,
    complete: slots.every((s) => s.winner !== null) && issues.length === 0,
    issues,
  };
}

// ---------------------------------------------------------------------------------------------
// Swiss
// ---------------------------------------------------------------------------------------------

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

export function swissOutcome(stage: SwissStage, results: SwissResults): SwissOutcome {
  const issues: OutcomeIssue[] = [];
  if (results.teams.length !== stage.teams) {
    issues.push({
      at: 'teams',
      message: `${results.teams.length} teams, the stage has ${stage.teams}`,
    });
  }
  const state = new Map<string, SwissTeamOutcome>();
  for (const team of results.teams) {
    if (state.has(team)) issues.push({ at: 'teams', message: `${team} is listed twice` });
    state.set(team, {
      team,
      wins: 0,
      losses: 0,
      record: '0-0',
      finishedInRound: null,
      eliminationRound: null,
      bucket: null,
    });
  }
  if (results.rounds.length > stage.rounds) {
    issues.push({
      at: 'rounds',
      message: `${results.rounds.length} rounds, the stage has ${stage.rounds}`,
    });
  }

  results.rounds.forEach((round, index) => {
    const at = `round ${index + 1}`;
    const played = new Set<string>();
    const updates: Array<[SwissTeamOutcome, 'win' | 'loss']> = [];
    for (const result of round) {
      const a = state.get(result.team1);
      const b = state.get(result.team2);
      const problem = [result.team1, result.team2].find((t) => !state.has(t));
      if (problem !== undefined || !a || !b) {
        issues.push({ at, message: `${problem} is not in this stage` });
        continue;
      }
      const already = [a, b].find((t) => played.has(t.team));
      if (already) {
        issues.push({ at, message: `${already.team} plays twice in one round` });
        continue;
      }
      const finished = [a, b].find((t) => t.finishedInRound !== null);
      if (finished) {
        issues.push({ at, message: `${finished.team} already finished with ${finished.record}` });
        continue;
      }
      played.add(a.team);
      played.add(b.team);
      const decisive = [a, b].some(
        (t) => t.wins + 1 === stage.winsToFinish || t.losses + 1 === stage.lossesToFinish,
      );
      const bestOf = decisive ? stage.bestOf.decisive : stage.bestOf.other;
      const outcome = decide(result, bestOf, `${at}: ${a.team} vs ${b.team}`, issues);
      if (outcome === null || 'draw' in outcome) continue;
      updates.push([state.get(outcome.winner)!, 'win'], [state.get(outcome.loser)!, 'loss']);
    }
    for (const [team, kind] of updates) {
      if (kind === 'win') team.wins += 1;
      else team.losses += 1;
      team.record = `${team.wins}-${team.losses}`;
      if (
        team.wins === stage.winsToFinish ||
        team.losses === stage.lossesToFinish ||
        team.wins + team.losses === stage.rounds
      ) {
        team.finishedInRound = index + 1;
      }
    }
  });

  const elimination = stage.eliminationRound;
  for (const result of results.eliminationRound ?? []) {
    const at = `elimination round: ${result.team1} vs ${result.team2}`;
    if (!elimination) {
      issues.push({ at, message: 'this stage has no elimination round' });
      continue;
    }
    const missing = [result.team1, result.team2].find((t) => !state.has(t));
    if (missing !== undefined) {
      issues.push({ at, message: `${missing} is not in this stage` });
      continue;
    }
    const ineligible = [state.get(result.team1)!, state.get(result.team2)!].find(
      (t) => t.finishedInRound === null || !elimination.records.includes(t.record),
    );
    if (ineligible !== undefined) {
      issues.push({
        at,
        message: `${ineligible.team} (${ineligible.record}) does not play the elimination round`,
      });
      continue;
    }
    const outcome = decide(result, elimination.bestOf, at, issues);
    if (outcome === null || 'draw' in outcome) continue;
    state.get(outcome.winner)!.eliminationRound = 'won';
    state.get(outcome.loser)!.eliminationRound = 'lost';
  }

  for (const team of state.values()) {
    if (team.finishedInRound === null) continue;
    const playsElimination = elimination?.records.includes(team.record) ?? false;
    if (playsElimination && team.eliminationRound === null) continue;
    const bucket = stage.buckets.find(
      (b) =>
        b.records.includes(team.record) &&
        (b.eliminationRound === undefined || b.eliminationRound === team.eliminationRound),
    );
    if (bucket === undefined) {
      issues.push({ at: team.team, message: `no bucket takes the record ${team.record}` });
      continue;
    }
    team.bucket = bucket.id;
  }

  const teams = [...state.values()];
  return { teams, complete: teams.every((t) => t.bucket !== null) && issues.length === 0, issues };
}

// ---------------------------------------------------------------------------------------------
// GSL groups
// ---------------------------------------------------------------------------------------------

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

export function gslGroupOutcome(stage: GslStage, results: GslGroupResults): GslGroupOutcome {
  const issues: OutcomeIssue[] = [];
  const at = (match: string) => `group ${results.group}, ${match}`;
  const members = new Set(results.teams);
  if (members.size !== 4)
    issues.push({ at: `group ${results.group}`, message: 'needs four different teams' });

  const play = (
    match: keyof GslGroupResults['series'],
    expected: [string, string] | null,
  ): { winner: string; loser: string } | null => {
    const result = results.series[match];
    if (result === undefined) return null;
    if (expected === null) {
      issues.push({ at: at(match), message: 'has a result before its teams are known' });
      return null;
    }
    if (!sameTeams(result, expected[0], expected[1])) {
      issues.push({
        at: at(match),
        message: `result is ${result.team1} vs ${result.team2}, expected ${expected[0]} vs ${expected[1]}`,
      });
      return null;
    }
    const outcome = decide(result, stage.bestOf, at(match), issues);
    return outcome === null || 'draw' in outcome ? null : outcome;
  };

  const openingTeams = (match: 'opening1' | 'opening2'): [string, string] | null => {
    const result = results.series[match];
    if (result === undefined) return null;
    if (!members.has(result.team1) || !members.has(result.team2)) {
      issues.push({ at: at(match), message: 'plays a team from outside the group' });
      return null;
    }
    return [result.team1, result.team2];
  };
  const o1Teams = openingTeams('opening1');
  const o2Teams = openingTeams('opening2');
  if (o1Teams && o2Teams && o1Teams.some((t) => o2Teams.includes(t))) {
    issues.push({ at: at('openings'), message: 'a team plays both openings' });
  }
  const o1 = o1Teams ? play('opening1', o1Teams) : null;
  const o2 = o2Teams ? play('opening2', o2Teams) : null;
  const winners = play('winners', o1 && o2 ? [o1.winner, o2.winner] : null);
  const elimination = play('elimination', o1 && o2 ? [o1.loser, o2.loser] : null);
  const decider = play(
    'decider',
    winners && elimination ? [winners.loser, elimination.winner] : null,
  );

  const outcome = {
    group: results.group,
    first: winners?.winner ?? null,
    second: decider?.winner ?? null,
    third: decider?.loser ?? null,
    fourth: elimination?.loser ?? null,
    issues,
  };
  return {
    ...outcome,
    complete: outcome.second !== null && outcome.first !== null && issues.length === 0,
  };
}

// ---------------------------------------------------------------------------------------------
// Round-robin groups
// ---------------------------------------------------------------------------------------------

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
  points?: { win: number; draw: number };
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

/** Tiebreakers are often shorter than group series; the score shows the length. */
const tiebreakerLength = (r: SeriesResult) => Math.max(r.score1, r.score2) * 2 - 1;

export function roundRobinGroupOutcome(
  stage: RoundRobinStage,
  results: RoundRobinGroupResults,
): RoundRobinGroupOutcome {
  const issues: OutcomeIssue[] = [];
  const at = `group ${results.group}`;
  const scoring = results.points ?? { win: 3, draw: 1 };
  const rows = new Map<string, RoundRobinRow>();
  for (const team of results.teams) {
    if (rows.has(team)) issues.push({ at, message: `${team} is listed twice` });
    rows.set(team, {
      team,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      mapsWon: 0,
      mapsLost: 0,
      mapDifference: 0,
      points: 0,
      rank: 0,
    });
  }
  if (results.teams.length !== stage.teamsPerGroup) {
    issues.push({
      at,
      message: `${results.teams.length} teams, groups have ${stage.teamsPerGroup}`,
    });
  }

  const pairs = new Set<string>();
  for (const result of results.series) {
    const label = `${at}: ${result.team1} vs ${result.team2}`;
    const a = rows.get(result.team1);
    const b = rows.get(result.team2);
    if (!a || !b) {
      issues.push({ at: label, message: 'plays a team from outside the group' });
      continue;
    }
    const outcome = decide(result, stage.bestOf, label, issues);
    if (outcome === null) continue;
    pairs.add([a.team, b.team].sort().join('\u0000'));
    for (const [row, won, lost] of [
      [a, result.score1, result.score2],
      [b, result.score2, result.score1],
    ] as const) {
      row.played += 1;
      row.mapsWon += won;
      row.mapsLost += lost;
      row.mapDifference = row.mapsWon - row.mapsLost;
    }
    if ('draw' in outcome) {
      for (const row of [a, b]) {
        row.draws += 1;
        row.points += scoring.draw;
      }
    } else {
      const winner = rows.get(outcome.winner)!;
      const loser = rows.get(outcome.loser)!;
      winner.wins += 1;
      winner.points += scoring.win;
      loser.losses += 1;
    }
  }

  const n = results.teams.length;
  const allPlayed = pairs.size === (n * (n - 1)) / 2;
  let table = [...rows.values()].sort(
    (x, y) => y.points - x.points || y.mapDifference - x.mapDifference,
  );
  let unresolved: Array<[number, number]> = [];

  if (results.order !== undefined) {
    const order = results.order;
    const valid =
      order.length === n && new Set(order).size === n && order.every((t) => rows.has(t));
    if (!valid) {
      issues.push({ at, message: 'order must list every team of the group once' });
    } else {
      table = order.map((team, i) => ({ ...rows.get(team)!, rank: i + 1 }));
    }
  }
  if (results.order === undefined || table.some((r) => r.rank === 0)) {
    // Group teams tied on points and map difference; a tiebreaker series splits a pair.
    const ranked: RoundRobinRow[] = [];
    let i = 0;
    while (i < table.length) {
      let j = i + 1;
      while (
        j < table.length &&
        table[j]!.points === table[i]!.points &&
        table[j]!.mapDifference === table[i]!.mapDifference
      ) {
        j += 1;
      }
      let tied = table.slice(i, j);
      if (tied.length === 2) {
        const [x, y] = tied as [RoundRobinRow, RoundRobinRow];
        const breaker = results.tiebreakers?.find((r) => sameTeams(r, x.team, y.team));
        const outcome = breaker
          ? decide(breaker, tiebreakerLength(breaker), `${at}: tiebreaker`, issues)
          : null;
        if (outcome !== null && !('draw' in outcome)) {
          tied = outcome.winner === x.team ? [x, y] : [y, x];
          tied.forEach((row, k) => ranked.push({ ...row, rank: i + k + 1 }));
          i = j;
          continue;
        }
      }
      if (tied.length > 1) unresolved.push([i + 1, j]);
      tied.forEach((row) => ranked.push({ ...row, rank: i + 1 }));
      i = j;
    }
    table = ranked;
  } else {
    unresolved = [];
  }

  const crosses = (cut: number) => unresolved.some(([from, to]) => from <= cut && to > cut);
  const cutUnclear = crosses(stage.advancePerGroup);
  const winnerUnclear = crosses(1);
  const complete = allPlayed || results.order !== undefined;
  const qualifiers =
    complete && !cutUnclear ? table.slice(0, stage.advancePerGroup).map((r) => r.team) : null;
  const winner = complete && !winnerUnclear ? (table[0]?.team ?? null) : null;

  return {
    group: results.group,
    table,
    qualifiers,
    winner,
    needsOrder: complete && (cutUnclear || winnerUnclear),
    complete: complete && qualifiers !== null && winner !== null && issues.length === 0,
    issues,
  };
}
