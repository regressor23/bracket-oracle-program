import { bracketOutcome, gslGroupOutcome, roundRobinGroupOutcome, swissOutcome, } from '../formats/outcomes.js';
import { roundStage } from '../formats/points.js';
import { checkPrediction } from '../predictions/validate.js';
import { rankEntries } from './rank.js';
import { scorePrediction } from './score.js';
/** The outcome of a predicted stage from its official results. */
export function stageOutcome(stage, results) {
    switch (stage.kind) {
        case 'bracket': {
            const outcome = bracketOutcome(stage, results);
            return {
                actual: { kind: 'bracket', outcome },
                complete: outcome.complete,
                issues: outcome.issues,
            };
        }
        case 'swiss': {
            const outcome = swissOutcome(stage, results);
            return {
                actual: { kind: 'swiss', outcome },
                complete: outcome.complete,
                issues: outcome.issues,
            };
        }
        case 'gsl': {
            const groups = results.groups.map((g) => gslGroupOutcome(stage, g));
            return {
                actual: { kind: 'gsl', groups },
                complete: groups.length === stage.groups && groups.every((g) => g.complete),
                issues: groups.flatMap((g) => g.issues),
            };
        }
        case 'round-robin': {
            const groups = results.groups.map((g) => roundRobinGroupOutcome(stage, g));
            return {
                actual: { kind: 'round-robin', groups },
                complete: groups.length === stage.groups && groups.every((g) => g.complete && !g.needsOrder),
                issues: groups.flatMap((g) => g.issues),
            };
        }
        case 'not-predicted':
            throw new Error(`${stage.id} is not predicted`);
    }
}
/**
 * Maps played in a stage, for the tie-break: every game of every series in the results. A forfeit
 * plays no maps, whatever score the organizer records for it.
 */
export function mapsPlayed(stage, results) {
    const series = [];
    const add = (value) => {
        if (value === undefined)
            return;
        if (Array.isArray(value))
            series.push(...value);
        else
            series.push(value);
    };
    switch (stage.kind) {
        case 'bracket':
            Object.values(results.series).forEach(add);
            break;
        case 'swiss': {
            const swiss = results;
            swiss.rounds.forEach(add);
            add(swiss.eliminationRound);
            break;
        }
        case 'gsl':
            for (const group of results.groups) {
                Object.values(group.series).forEach(add);
            }
            break;
        case 'round-robin':
            for (const group of results.groups) {
                add(group.series);
                add(group.tiebreakers);
            }
            break;
        case 'not-predicted':
            break;
    }
    return series.reduce((sum, s) => sum + (s.forfeit ? 0 : s.score1 + s.score2), 0);
}
export function scoreContest(input) {
    const { template, round, results, settings } = input;
    const stage = roundStage(template, round);
    if (!stage || stage.kind === 'not-predicted') {
        throw new Error(`${template.id} has no ${round} round`);
    }
    const outcome = stageOutcome(stage, results);
    const maps = outcome.complete ? mapsPlayed(stage, results) : null;
    const scored = input.entries.map((entry) => {
        const check = checkPrediction(entry.prediction, {
            template,
            ...(input.contest === undefined ? {} : { contest: input.contest }),
        });
        const issues = check.issues.map((i) => `${i.path || '<root>'}: ${i.message}`);
        if (check.prediction && check.prediction.round !== round) {
            issues.push(`round: the prediction is for the ${check.prediction.round} round`);
        }
        if (!check.prediction || issues.length > 0) {
            return {
                id: entry.id,
                hash: check.hash,
                points: 0,
                correct: 0,
                exactScores: 0,
                pending: 0,
                tiebreak: null,
                issues,
            };
        }
        const score = scorePrediction(stage, check.prediction, outcome.actual, settings);
        return {
            id: entry.id,
            hash: check.hash,
            points: score.points,
            correct: score.correct,
            exactScores: score.exactScores,
            pending: score.pending,
            tiebreak: check.prediction.tiebreak?.maps ?? null,
            issues,
        };
    });
    const valid = scored.filter((s) => s.issues.length === 0);
    const invalid = scored.filter((s) => s.issues.length > 0);
    const byId = new Map(valid.map((s) => [s.id, s]));
    const ranked = rankEntries(valid.map(({ id, points, tiebreak }) => ({ id, points, tiebreak })), maps);
    return {
        template: { id: template.id, version: template.version },
        round,
        stage: stage.id,
        complete: outcome.complete,
        mapsPlayed: maps,
        issues: outcome.issues,
        entries: [
            ...ranked.map((r) => ({ ...byId.get(r.id), distance: r.distance, place: r.place })),
            ...invalid.map((s) => ({ ...s, distance: null, place: null })),
        ],
    };
}
//# sourceMappingURL=contest.js.map