export function rankEntries(entries, actualMaps = null) {
    const withDistance = entries.map((entry) => ({
        ...entry,
        distance: actualMaps === null || entry.tiebreak === null ? null : Math.abs(entry.tiebreak - actualMaps),
    }));
    // Unanswered tie-breaks sort after every answered one; before the round ends nobody is apart.
    const tiebreakKey = (d) => actualMaps === null ? 0 : d === null ? Number.POSITIVE_INFINITY : d;
    const compare = (a, b) => {
        if (a.points !== b.points)
            return b.points - a.points;
        const x = tiebreakKey(a.distance);
        const y = tiebreakKey(b.distance);
        // Not a subtraction: two unanswered tie-breaks are both Infinity, and Infinity - Infinity is NaN.
        return x === y ? 0 : x < y ? -1 : 1;
    };
    // Ids only order entries inside a shared place, so the output is stable.
    const sorted = [...withDistance].sort((a, b) => compare(a, b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const ranked = [];
    let start = 0;
    while (start < sorted.length) {
        let end = start + 1;
        while (end < sorted.length && compare(sorted[start], sorted[end]) === 0)
            end += 1;
        for (let i = start; i < end; i += 1) {
            ranked.push({ ...sorted[i], place: { from: start + 1, to: end } });
        }
        start = end;
    }
    return ranked;
}
//# sourceMappingURL=rank.js.map