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
    place: {
        from: number;
        to: number;
    };
}
export declare function rankEntries(entries: readonly RankInput[], actualMaps?: number | null): RankedEntry[];
//# sourceMappingURL=rank.d.ts.map