/**
 * Builders for the bracket shapes tier-1 events use. Slot wiring matches the brackets on
 * Liquipedia (TI 2026, PGL Wallachia S9, MSI 2026, BLAST Slam VIII): an upper-semifinal loser
 * drops into the half of the lower bracket opposite its own, so nobody replays right away.
 */
const position = (n) => ({ position: n });
const winnerOf = (slot) => ({ winnerOf: slot });
const loserOf = (slot) => ({ loserOf: slot });
const slot = (id, round, top, bottom) => ({
    id,
    round,
    top,
    bottom,
});
/** Points from the rules: upper 10 / 15 / 20, lower 5 / 10 / 15 / 20, grand final 40. */
export const DOUBLE_ELIMINATION_8_POINTS = {
    ubqf: 10,
    ubsf: 15,
    ubf: 20,
    lbr1: 5,
    lbqf: 10,
    lbsf: 15,
    lbf: 20,
    gf: 40,
};
/** Points from the rules: doubling each round, final 40. */
export const SINGLE_ELIMINATION_8_POINTS = { qf: 10, sf: 20, final: 40 };
/** Six-team double elimination: the 8-team points without the first lower round. */
export const DOUBLE_ELIMINATION_6_POINTS = {
    ubqf: 10,
    ubsf: 15,
    ubf: 20,
    lbqf: 10,
    lbsf: 15,
    lbf: 20,
    gf: 40,
};
/** Eight teams; positions 1–8 fill the four upper quarterfinals from the top. */
export function doubleElimination8(options) {
    const names = {
        ubqf: 'Upper bracket quarterfinals',
        ubsf: 'Upper bracket semifinals',
        ubf: 'Upper bracket final',
        lbr1: 'Lower bracket round 1',
        lbqf: 'Lower bracket quarterfinals',
        lbsf: 'Lower bracket semifinals',
        lbf: 'Lower bracket final',
        gf: 'Grand final',
        ...options.names,
    };
    const round = (id, side) => ({
        id,
        name: names[id],
        side,
        bestOf: id === 'gf' ? options.grandFinalBestOf : options.bestOf,
        points: DOUBLE_ELIMINATION_8_POINTS[id],
    });
    return {
        id: options.id,
        name: options.name,
        kind: 'bracket',
        style: 'double-elimination',
        teams: 8,
        rounds: [
            round('ubqf', 'upper'),
            round('ubsf', 'upper'),
            round('ubf', 'upper'),
            round('lbr1', 'lower'),
            round('lbqf', 'lower'),
            round('lbsf', 'lower'),
            round('lbf', 'lower'),
            round('gf', 'final'),
        ],
        slots: [
            slot('ubqf-1', 'ubqf', position(1), position(2)),
            slot('ubqf-2', 'ubqf', position(3), position(4)),
            slot('ubqf-3', 'ubqf', position(5), position(6)),
            slot('ubqf-4', 'ubqf', position(7), position(8)),
            slot('ubsf-1', 'ubsf', winnerOf('ubqf-1'), winnerOf('ubqf-2')),
            slot('ubsf-2', 'ubsf', winnerOf('ubqf-3'), winnerOf('ubqf-4')),
            slot('lbr1-1', 'lbr1', loserOf('ubqf-1'), loserOf('ubqf-2')),
            slot('lbr1-2', 'lbr1', loserOf('ubqf-3'), loserOf('ubqf-4')),
            slot('lbqf-1', 'lbqf', loserOf('ubsf-2'), winnerOf('lbr1-1')),
            slot('lbqf-2', 'lbqf', loserOf('ubsf-1'), winnerOf('lbr1-2')),
            slot('ubf', 'ubf', winnerOf('ubsf-1'), winnerOf('ubsf-2')),
            slot('lbsf', 'lbsf', winnerOf('lbqf-1'), winnerOf('lbqf-2')),
            slot('lbf', 'lbf', loserOf('ubf'), winnerOf('lbsf')),
            slot('gf', 'gf', winnerOf('ubf'), winnerOf('lbf')),
        ],
    };
}
/**
 * Six teams, as at BLAST Slam VIII and IX: positions 1 and 4 start in the upper semifinals,
 * positions 2–3 and 5–6 in the upper quarterfinals. Every lower-bracket match pairs an upper
 * semifinal loser with the quarterfinal loser from the other half.
 */
export function doubleElimination6(options) {
    const names = {
        ubqf: 'Upper bracket quarterfinals',
        ubsf: 'Upper bracket semifinals',
        ubf: 'Upper bracket final',
        lbqf: 'Lower bracket quarterfinals',
        lbsf: 'Lower bracket semifinal',
        lbf: 'Lower bracket final',
        gf: 'Grand final',
    };
    const round = (id, side) => ({
        id,
        name: names[id],
        side,
        bestOf: id === 'gf' ? options.grandFinalBestOf : options.bestOf,
        points: DOUBLE_ELIMINATION_6_POINTS[id],
    });
    return {
        id: options.id,
        name: options.name,
        kind: 'bracket',
        style: 'double-elimination',
        teams: 6,
        rounds: [
            round('ubqf', 'upper'),
            round('ubsf', 'upper'),
            round('ubf', 'upper'),
            round('lbqf', 'lower'),
            round('lbsf', 'lower'),
            round('lbf', 'lower'),
            round('gf', 'final'),
        ],
        slots: [
            slot('ubqf-1', 'ubqf', position(2), position(3)),
            slot('ubqf-2', 'ubqf', position(5), position(6)),
            slot('ubsf-1', 'ubsf', position(1), winnerOf('ubqf-1')),
            slot('ubsf-2', 'ubsf', position(4), winnerOf('ubqf-2')),
            slot('lbqf-1', 'lbqf', loserOf('ubsf-1'), loserOf('ubqf-2')),
            slot('lbqf-2', 'lbqf', loserOf('ubsf-2'), loserOf('ubqf-1')),
            slot('ubf', 'ubf', winnerOf('ubsf-1'), winnerOf('ubsf-2')),
            slot('lbsf', 'lbsf', winnerOf('lbqf-1'), winnerOf('lbqf-2')),
            slot('lbf', 'lbf', loserOf('ubf'), winnerOf('lbsf')),
            slot('gf', 'gf', winnerOf('ubf'), winnerOf('lbf')),
        ],
    };
}
/** Eight teams; positions 1–8 fill the four quarterfinals from the top. */
export function singleElimination8(options) {
    const round = (id, side) => ({
        id,
        ...options.rounds[id],
        side,
        points: SINGLE_ELIMINATION_8_POINTS[id],
    });
    return {
        id: options.id,
        name: options.name,
        kind: 'bracket',
        style: 'single-elimination',
        teams: 8,
        rounds: [round('qf', 'upper'), round('sf', 'upper'), round('final', 'final')],
        slots: [
            slot('qf-1', 'qf', position(1), position(2)),
            slot('qf-2', 'qf', position(3), position(4)),
            slot('qf-3', 'qf', position(5), position(6)),
            slot('qf-4', 'qf', position(7), position(8)),
            slot('sf-1', 'sf', winnerOf('qf-1'), winnerOf('qf-2')),
            slot('sf-2', 'sf', winnerOf('qf-3'), winnerOf('qf-4')),
            slot('final', 'final', winnerOf('sf-1'), winnerOf('sf-2')),
        ],
    };
}
/**
 * Six teams with two byes: positions 1 and 2 enter in the semifinals, 3–6 play the
 * quarterfinals. Same points as eight teams.
 */
export function singleElimination6(options) {
    const round = (id, side) => ({
        id,
        ...options.rounds[id],
        side,
        points: SINGLE_ELIMINATION_8_POINTS[id],
    });
    return {
        id: options.id,
        name: options.name,
        kind: 'bracket',
        style: 'single-elimination',
        teams: 6,
        rounds: [round('qf', 'upper'), round('sf', 'upper'), round('final', 'final')],
        slots: [
            slot('qf-1', 'qf', position(4), position(5)),
            slot('qf-2', 'qf', position(3), position(6)),
            slot('sf-1', 'sf', position(1), winnerOf('qf-1')),
            slot('sf-2', 'sf', position(2), winnerOf('qf-2')),
            slot('final', 'final', winnerOf('sf-1'), winnerOf('sf-2')),
        ],
    };
}
//# sourceMappingURL=brackets.js.map