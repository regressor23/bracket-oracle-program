import { EXACT_SCORE_BONUS } from '../formats/points.js';
import { resolveBracket } from '../formats/resolve.js';
const TENTHS = 10;
/** The underdog multiplier ×1.5, in tenths of a point per point. */
const UNDERDOG_TENTHS = 15;
/** Formats tenths for display with one decimal, for example 75 → "7.5". */
export function formatPoints(tenths) {
    const sign = tenths < 0 ? '-' : '';
    const abs = Math.abs(tenths);
    return `${sign}${Math.floor(abs / TENTHS)}.${abs % TENTHS}`;
}
/** Counts each slot's picked winners across predictions of a round, for the underdog rule. */
export function pickShares(predictions) {
    const slots = {};
    for (const prediction of predictions) {
        if (prediction.picks.kind !== 'bracket')
            continue;
        for (const [slot, pick] of Object.entries(prediction.picks.slots)) {
            const counts = (slots[slot] ??= {});
            counts[pick.winner] = (counts[pick.winner] ?? 0) + 1;
        }
    }
    return { total: predictions.length, slots };
}
/**
 * True when fewer than 25% of the round's predictions picked this winner for the slot. Picks on a
 * team it replaced count as picks on it.
 */
export function isUnderdog(shares, slot, team, replacements = {}) {
    const counts = shares.slots[slot] ?? {};
    let picked = counts[team] ?? 0;
    for (const [old, now] of Object.entries(replacements)) {
        if (now === team && old !== team)
            picked += counts[old] ?? 0;
    }
    return shares.total > 0 && picked * 4 < shares.total;
}
/** The teams in a bracket's starting positions, read from the outcome's first-round slots. */
function positionsOf(stage, outcome) {
    const positions = Array.from({ length: stage.teams }, () => null);
    const slots = new Map(outcome.slots.map((s) => [s.id, s]));
    for (const slot of stage.slots) {
        const actual = slots.get(slot.id);
        if ('position' in slot.top)
            positions[slot.top.position - 1] = actual?.top ?? null;
        if ('position' in slot.bottom)
            positions[slot.bottom.position - 1] = actual?.bottom ?? null;
    }
    return positions;
}
function replaced(picks, replacements) {
    const to = (team) => replacements[team] ?? team;
    switch (picks.kind) {
        case 'swiss':
            return {
                kind: 'swiss',
                buckets: Object.fromEntries(Object.entries(picks.buckets).map(([t, b]) => [to(t), b])),
            };
        case 'gsl':
            return {
                kind: 'gsl',
                groups: Object.fromEntries(Object.entries(picks.groups).map(([label, g]) => [
                    label,
                    {
                        ...(g.first === undefined ? {} : { first: to(g.first) }),
                        ...(g.second === undefined ? {} : { second: to(g.second) }),
                    },
                ])),
            };
        case 'round-robin':
            return {
                kind: 'round-robin',
                groups: Object.fromEntries(Object.entries(picks.groups).map(([label, g]) => [
                    label,
                    {
                        qualifiers: g.qualifiers.map(to),
                        ...(g.winner === undefined ? {} : { winner: to(g.winner) }),
                    },
                ])),
            };
        case 'bracket':
            return {
                kind: 'bracket',
                slots: Object.fromEntries(Object.entries(picks.slots).map(([slot, p]) => [slot, { ...p, winner: to(p.winner) }])),
            };
    }
}
const pick = (path, result, points = 0, bonus = 0, underdog = false) => ({ path, result, points, bonus, underdog });
function scoreBracket(stage, picks, outcome, settings) {
    const rounds = new Map(stage.rounds.map((r) => [r.id, r]));
    const actual = new Map(outcome.slots.map((s) => [s.id, s]));
    const winners = Object.fromEntries(Object.entries(picks.slots).map(([s, p]) => [s, p.winner]));
    // A pick on a team the player's own earlier picks did not bring to the slot scores nothing:
    // otherwise a bracket could back a team to lose a series and still win the slot after it.
    const stale = new Set(resolveBracket(stage, positionsOf(stage, outcome), winners).stalePicks);
    const scores = [];
    for (const slot of stage.slots) {
        const chosen = picks.slots[slot.id];
        if (!chosen)
            continue;
        const path = `picks.slots.${slot.id}`;
        if (stale.has(slot.id)) {
            scores.push(pick(path, 'stale'));
            continue;
        }
        const result = actual.get(slot.id);
        if (!result?.winner) {
            scores.push(pick(path, 'pending'));
            continue;
        }
        // A pick is the slot: it counts when the slot's actual winner is the picked team, however
        // that team got there (rules, «Пік — це слот сітки»).
        if (result.winner !== chosen.winner) {
            scores.push(pick(path, 'wrong'));
            continue;
        }
        const round = rounds.get(slot.round);
        const underdog = settings.underdog !== undefined &&
            isUnderdog(settings.underdog, slot.id, chosen.winner, settings.replacements);
        const points = round.points * (underdog ? UNDERDOG_TENTHS : TENTHS);
        let bonus = 0;
        if (chosen.score && result.score && !result.forfeit && round.bestOf > 1) {
            const [top, bottom] = result.score;
            const [won, lost] = result.winner === result.top ? [top, bottom] : [bottom, top];
            if (chosen.score[0] === won && chosen.score[1] === lost) {
                bonus = EXACT_SCORE_BONUS[round.bestOf] * TENTHS;
            }
        }
        scores.push(pick(path, 'correct', points, bonus, underdog));
    }
    return scores;
}
function scoreSwiss(stage, picks, outcome) {
    const buckets = new Map(stage.buckets.map((b) => [b.id, b]));
    const teams = new Map(outcome.teams.map((t) => [t.team, t]));
    return Object.entries(picks.buckets)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([team, bucketId]) => {
        const path = `picks.buckets.${team}`;
        const actual = teams.get(team);
        const bucket = buckets.get(bucketId);
        if (!actual || !bucket)
            return pick(path, 'stale');
        if (actual.bucket === null)
            return pick(path, 'pending');
        // Strict: only the exact bucket scores (format templates, decision 4).
        return actual.bucket === bucketId
            ? pick(path, 'correct', bucket.points * TENTHS)
            : pick(path, 'wrong');
    });
}
function scoreGsl(stage, picks, groups) {
    const scores = [];
    for (const [label, group] of Object.entries(picks.groups)) {
        const actual = groups.find((g) => g.group === label);
        for (const place of ['first', 'second']) {
            const team = group[place];
            if (team === undefined)
                continue;
            const path = `picks.groups.${label}.${place}`;
            // A group without results yet is still to be played.
            if (!actual || actual[place] === null)
                scores.push(pick(path, 'pending'));
            else if (actual[place] === team) {
                scores.push(pick(path, 'correct', stage.points[place] * TENTHS));
            }
            else
                scores.push(pick(path, 'wrong'));
        }
    }
    return scores;
}
function scoreRoundRobin(stage, picks, groups) {
    const scores = [];
    for (const [label, group] of Object.entries(picks.groups)) {
        const actual = groups.find((g) => g.group === label);
        group.qualifiers.forEach((team, i) => {
            const path = `picks.groups.${label}.qualifiers[${i}]`;
            if (!actual || actual.qualifiers === null)
                scores.push(pick(path, 'pending'));
            else if (actual.qualifiers.includes(team)) {
                scores.push(pick(path, 'correct', stage.points.perQualifier * TENTHS));
            }
            else
                scores.push(pick(path, 'wrong'));
        });
        if (group.winner === undefined)
            continue;
        const path = `picks.groups.${label}.winner`;
        if (!actual || actual.winner === null)
            scores.push(pick(path, 'pending'));
        else if (actual.winner === group.winner) {
            scores.push(pick(path, 'correct', stage.points.groupWinner * TENTHS));
        }
        else
            scores.push(pick(path, 'wrong'));
    }
    return scores;
}
/**
 * Scores one prediction against the outcome of the stage it predicts. Empty picks score nothing
 * and are not listed. The caller checks the document first (`checkPrediction`); a stage of
 * another kind than the picks scores nothing.
 */
export function scorePrediction(stage, prediction, actual, settings = {}) {
    const picks = settings.replacements
        ? replaced(prediction.picks, settings.replacements)
        : prediction.picks;
    let scores = [];
    if (stage.kind === 'bracket' && picks.kind === 'bracket' && actual.kind === 'bracket') {
        scores = scoreBracket(stage, picks, actual.outcome, settings);
    }
    else if (stage.kind === 'swiss' && picks.kind === 'swiss' && actual.kind === 'swiss') {
        scores = scoreSwiss(stage, picks, actual.outcome);
    }
    else if (stage.kind === 'gsl' && picks.kind === 'gsl' && actual.kind === 'gsl') {
        scores = scoreGsl(stage, picks, actual.groups);
    }
    else if (stage.kind === 'round-robin' &&
        picks.kind === 'round-robin' &&
        actual.kind === 'round-robin') {
        scores = scoreRoundRobin(stage, picks, actual.groups);
    }
    return {
        points: scores.reduce((sum, s) => sum + s.points + s.bonus, 0),
        correct: scores.filter((s) => s.result === 'correct').length,
        exactScores: scores.filter((s) => s.bonus > 0).length,
        pending: scores.filter((s) => s.result === 'pending').length,
        picks: scores,
    };
}
//# sourceMappingURL=score.js.map