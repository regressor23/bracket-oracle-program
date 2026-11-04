import { doubleElimination6, doubleElimination8, singleElimination8 } from './brackets.js';
/**
 * The six launch templates, each checked against the latest edition on Liquipedia on the date in
 * `reference.checkedOn`. Points follow the rules approved on 22 October 2026; an admin may change
 * them for one tournament only before its round opens.
 */
const CHECKED_ON = '2026-10-25';
const LOCK_MINUTES_BEFORE = 5;
/** CS2 and LoL style: 3-0 and 0-3 are worth 15 per team, "advance" and "eliminated" 10. */
const threeWinBuckets = [
    { id: '3-0', label: '3-0', size: 2, points: 15, records: ['3-0'], advances: true },
    {
        id: 'advance',
        label: 'Advance (3-1 or 3-2)',
        size: 6,
        points: 10,
        records: ['3-1', '3-2'],
        advances: true,
    },
    {
        id: 'eliminated',
        label: 'Eliminated (2-3 or 1-3)',
        size: 6,
        points: 10,
        records: ['2-3', '1-3'],
        advances: false,
    },
    { id: '0-3', label: '0-3', size: 2, points: 15, records: ['0-3'], advances: false },
];
function threeWinSwiss(id, name, bestOf) {
    return {
        id,
        name,
        kind: 'swiss',
        teams: 16,
        winsToFinish: 3,
        lossesToFinish: 3,
        rounds: 5,
        bestOf,
        buckets: threeWinBuckets,
    };
}
export const theInternational = {
    id: 'ti',
    version: 1,
    game: 'dota2',
    name: 'The International',
    reference: {
        event: 'The International 2026',
        url: 'https://liquipedia.net/dota2/The_International/2026',
        checkedOn: CHECKED_ON,
    },
    stages: [
        {
            id: 'group-stage',
            name: 'Group stage',
            kind: 'swiss',
            teams: 16,
            winsToFinish: 4,
            lossesToFinish: 4,
            rounds: 5,
            bestOf: { decisive: 3, other: 3 },
            eliminationRound: {
                records: ['3-2', '2-3'],
                bestOf: 3,
                pairing: 'higher-seed-picks-opponent',
            },
            buckets: [
                {
                    id: 'direct',
                    label: 'Straight to the Main Event (4-0 or 4-1)',
                    size: 3,
                    points: 15,
                    records: ['4-0', '4-1'],
                    advances: true,
                },
                {
                    id: 'elimination-won',
                    label: 'Through the elimination round',
                    size: 5,
                    points: 10,
                    records: ['3-2', '2-3'],
                    eliminationRound: 'won',
                    advances: true,
                },
                {
                    id: 'elimination-lost',
                    label: 'Out in the elimination round',
                    size: 5,
                    points: 10,
                    records: ['3-2', '2-3'],
                    eliminationRound: 'lost',
                    advances: false,
                },
                {
                    id: 'out',
                    label: 'Out in the Swiss rounds (1-4 or 0-4)',
                    size: 3,
                    points: 15,
                    records: ['1-4', '0-4'],
                    advances: false,
                },
            ],
        },
        doubleElimination8({
            id: 'main-event',
            name: 'Main Event',
            bestOf: 3,
            grandFinalBestOf: 5,
        }),
    ],
    rounds: {
        groups: { stage: 'group-stage', lockMinutesBefore: LOCK_MINUTES_BEFORE },
        bracket: { stage: 'main-event', lockMinutesBefore: LOCK_MINUTES_BEFORE },
    },
};
export const pglWallachia = {
    id: 'pgl-wallachia',
    version: 1,
    game: 'dota2',
    name: 'PGL Wallachia',
    reference: {
        event: 'PGL Wallachia Season 9',
        url: 'https://liquipedia.net/dota2/PGL/Wallachia/9',
        checkedOn: CHECKED_ON,
    },
    stages: [
        threeWinSwiss('group-stage', 'Group stage', { decisive: 3, other: 3 }),
        doubleElimination8({ id: 'playoffs', name: 'Playoffs', bestOf: 3, grandFinalBestOf: 5 }),
    ],
    rounds: {
        groups: { stage: 'group-stage', lockMinutesBefore: LOCK_MINUTES_BEFORE },
        bracket: { stage: 'playoffs', lockMinutesBefore: LOCK_MINUTES_BEFORE },
    },
};
export const blastSlam = {
    id: 'blast-slam',
    version: 1,
    game: 'dota2',
    name: 'BLAST Slam',
    reference: {
        event: 'BLAST Slam IX',
        url: 'https://liquipedia.net/dota2/BLAST/SLAM/9',
        checkedOn: CHECKED_ON,
    },
    stages: [
        {
            id: 'group-stage',
            name: 'Group stage',
            kind: 'gsl',
            groups: 4,
            bestOf: 3,
            points: { first: 10, second: 10 },
        },
        {
            id: 'seeding',
            name: 'Seeding and last chance',
            kind: 'not-predicted',
            teams: 8,
            summary: 'Group winners play two seeding matches: winners go to the upper semifinals, losers to ' +
                'the upper quarterfinals. Runners-up play two last-chance matches: winners go to the ' +
                'upper quarterfinals, losers are out. All Bo3.',
        },
        doubleElimination6({ id: 'playoffs', name: 'Playoffs', bestOf: 3, grandFinalBestOf: 5 }),
    ],
    rounds: {
        groups: { stage: 'group-stage', lockMinutesBefore: LOCK_MINUTES_BEFORE },
        bracket: { stage: 'playoffs', lockMinutesBefore: LOCK_MINUTES_BEFORE },
    },
};
/**
 * Version 2 (3 November 2026): every Stage 3 series is Bo3, as at IEM Cologne Major 2026 and PGL
 * Major Singapore 2026. Version 1 had Bo1 for series that neither advance nor eliminate, as at
 * StarLadder Budapest Major 2025; the replay fixture of that Major keeps version 1.
 */
export const cs2Major = {
    id: 'cs2-major',
    version: 2,
    game: 'cs2',
    name: 'CS2 Major',
    reference: {
        event: 'PGL Major Singapore 2026',
        url: 'https://liquipedia.net/counterstrike/PGL/2026/Singapore',
        checkedOn: '2026-11-03',
    },
    stages: [
        {
            id: 'stage-1',
            name: 'Stage 1',
            kind: 'not-predicted',
            teams: 16,
            summary: '16-team Swiss to three wins or losses; advancement and elimination matches Bo3, the ' +
                'rest Bo1. The top eight go to Stage 2.',
        },
        {
            id: 'stage-2',
            name: 'Stage 2',
            kind: 'not-predicted',
            teams: 16,
            summary: 'Same as Stage 1 with eight new teams. The top eight go to Stage 3.',
        },
        threeWinSwiss('stage-3', 'Stage 3', { decisive: 3, other: 3 }),
        singleElimination8({
            id: 'playoffs',
            name: 'Playoffs',
            rounds: {
                qf: { name: 'Quarterfinals', bestOf: 3 },
                sf: { name: 'Semifinals', bestOf: 3 },
                final: { name: 'Grand final', bestOf: 5 },
            },
        }),
    ],
    rounds: {
        groups: { stage: 'stage-3', lockMinutesBefore: LOCK_MINUTES_BEFORE },
        bracket: { stage: 'playoffs', lockMinutesBefore: LOCK_MINUTES_BEFORE },
    },
};
export const lolWorlds = {
    id: 'lol-worlds',
    version: 1,
    game: 'lol',
    name: 'League of Legends World Championship',
    reference: {
        event: '2026 World Championship',
        url: 'https://liquipedia.net/leagueoflegends/World_Championship/2026',
        checkedOn: CHECKED_ON,
    },
    stages: [
        {
            id: 'play-in',
            name: 'Play-In',
            kind: 'not-predicted',
            teams: 4,
            summary: 'Four teams in a Bo5 double-elimination bracket; the winner joins the Swiss stage.',
        },
        threeWinSwiss('swiss-stage', 'Swiss stage', { decisive: 3, other: 1 }),
        singleElimination8({
            id: 'knockout-stage',
            name: 'Knockout stage',
            rounds: {
                qf: { name: 'Quarterfinals', bestOf: 5 },
                sf: { name: 'Semifinals', bestOf: 5 },
                final: { name: 'Final', bestOf: 5 },
            },
        }),
    ],
    rounds: {
        groups: { stage: 'swiss-stage', lockMinutesBefore: LOCK_MINUTES_BEFORE },
        bracket: { stage: 'knockout-stage', lockMinutesBefore: LOCK_MINUTES_BEFORE },
    },
};
export const lolMsi = {
    id: 'lol-msi',
    version: 1,
    game: 'lol',
    name: 'Mid-Season Invitational',
    reference: {
        event: '2026 Mid-Season Invitational',
        url: 'https://liquipedia.net/leagueoflegends/Mid-Season_Invitational/2026',
        checkedOn: CHECKED_ON,
    },
    stages: [
        {
            id: 'play-in',
            name: 'Play-In',
            kind: 'not-predicted',
            teams: 4,
            summary: 'Four teams in a Bo5 double-elimination bracket; the winner joins the bracket stage.',
        },
        doubleElimination8({
            id: 'bracket-stage',
            name: 'Bracket stage',
            bestOf: 5,
            grandFinalBestOf: 5,
            names: {
                ubqf: 'Upper bracket round 1',
                ubsf: 'Upper bracket round 2',
                lbqf: 'Lower bracket round 2',
                lbsf: 'Lower bracket round 3',
            },
        }),
    ],
    rounds: {
        bracket: { stage: 'bracket-stage', lockMinutesBefore: LOCK_MINUTES_BEFORE },
    },
};
export const FORMAT_TEMPLATES = [
    theInternational,
    pglWallachia,
    blastSlam,
    cs2Major,
    lolWorlds,
    lolMsi,
];
export function getFormatTemplate(id) {
    return FORMAT_TEMPLATES.find((template) => template.id === id);
}
//# sourceMappingURL=templates.js.map