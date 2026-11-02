import type { BracketStage } from './schema.js';
export interface ResolvedSlot {
    id: string;
    round: string;
    top: string | null;
    bottom: string | null;
    /** The chosen winner, or null when the slot is empty or the pick no longer fits. */
    winner: string | null;
    loser: string | null;
}
export interface ResolvedBracket {
    slots: ResolvedSlot[];
    /** Slots whose chosen winner is not one of the two teams the earlier picks put there. */
    stalePicks: string[];
}
/**
 * Walks a bracket from starting positions and a winner per slot, the way a player fills it in:
 * every pick decides who plays the next slots, and picked losers drop to the lower bracket on
 * their own. Works the same for a player's picks and for official results.
 *
 * @param positions team ids for positions 1..teams, top to bottom (null for an unknown team)
 * @param winners chosen winner per slot id
 */
export declare function resolveBracket(stage: BracketStage, positions: readonly (string | null)[], winners: Readonly<Record<string, string>>): ResolvedBracket;
//# sourceMappingURL=resolve.d.ts.map