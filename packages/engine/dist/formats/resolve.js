/**
 * Walks a bracket from starting positions and a winner per slot, the way a player fills it in:
 * every pick decides who plays the next slots, and picked losers drop to the lower bracket on
 * their own. Works the same for a player's picks and for official results.
 *
 * @param positions team ids for positions 1..teams, top to bottom (null for an unknown team)
 * @param winners chosen winner per slot id
 */
export function resolveBracket(stage, positions, winners) {
    const resolved = new Map();
    const stalePicks = [];
    const teamFrom = (source) => {
        if ('position' in source)
            return positions[source.position - 1] ?? null;
        if ('winnerOf' in source)
            return resolved.get(source.winnerOf)?.winner ?? null;
        return resolved.get(source.loserOf)?.loser ?? null;
    };
    for (const slot of stage.slots) {
        const top = teamFrom(slot.top);
        const bottom = teamFrom(slot.bottom);
        const pick = winners[slot.id] ?? null;
        // The picked team must be one the earlier picks brought here; the other side may be unknown.
        const fits = pick !== null && (pick === top || pick === bottom);
        if (pick !== null && !fits)
            stalePicks.push(slot.id);
        const winner = fits ? pick : null;
        const loser = winner === null ? null : winner === top ? bottom : top;
        resolved.set(slot.id, { id: slot.id, round: slot.round, top, bottom, winner, loser });
    }
    return { slots: [...resolved.values()], stalePicks };
}
//# sourceMappingURL=resolve.js.map