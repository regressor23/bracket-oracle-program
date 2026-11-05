import type { Tenths } from './score.js';

/**
 * Ranking (rules, «Тай-брейк»): more points first. Among equal points, the prediction whose
 * tie-break (total maps of the round) is closer to the actual number ranks higher, and an empty
 * tie-break ranks last. Entries still equal share their places, for example 2-3, and split the
 * prizes of those places.
 *
 * The tie-break applies once the actual number of maps is known, that is when the round is
 * complete; before that, equal points share a place.
 */

export interface RankInput {
  id: string;
  points: Tenths;
  /** The player's total maps, or null when not answered. */
  tiebreak: number | null;
}

export interface RankedEntry extends RankInput {
  /** Distance from the actual number of maps; null when unanswered or not known yet. */
  distance: number | null;
  /** Places this entry shares, for example { from: 2, to: 3 }; from equals to when alone. */
  place: { from: number; to: number };
}

export function rankEntries(
  entries: readonly RankInput[],
  actualMaps: number | null = null,
): RankedEntry[] {
  const withDistance = entries.map((entry) => ({
    ...entry,
    distance:
      actualMaps === null || entry.tiebreak === null ? null : Math.abs(entry.tiebreak - actualMaps),
  }));
  // Unanswered tie-breaks sort after every answered one; before the round ends nobody is apart.
  const tiebreakKey = (d: number | null) =>
    actualMaps === null ? 0 : d === null ? Number.POSITIVE_INFINITY : d;
  const compare = (a: (typeof withDistance)[number], b: (typeof withDistance)[number]) => {
    if (a.points !== b.points) return b.points - a.points;
    const x = tiebreakKey(a.distance);
    const y = tiebreakKey(b.distance);
    // Not a subtraction: two unanswered tie-breaks are both Infinity, and Infinity - Infinity is NaN.
    return x === y ? 0 : x < y ? -1 : 1;
  };

  // Ids only order entries inside a shared place, so the output is stable.
  const sorted = [...withDistance].sort(
    (a, b) => compare(a, b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const ranked: RankedEntry[] = [];
  let start = 0;
  while (start < sorted.length) {
    let end = start + 1;
    while (end < sorted.length && compare(sorted[start]!, sorted[end]!) === 0) end += 1;
    for (let i = start; i < end; i += 1) {
      ranked.push({ ...sorted[i]!, place: { from: start + 1, to: end } });
    }
    start = end;
  }
  return ranked;
}
