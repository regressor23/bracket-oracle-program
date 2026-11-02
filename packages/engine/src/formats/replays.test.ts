import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  bracketOutcome,
  gslGroupOutcome,
  roundRobinGroupOutcome,
  swissOutcome,
  type BracketResults,
  type GslGroupResults,
  type RoundRobinGroupResults,
  type SeriesResult,
  type SwissResults,
} from './outcomes.js';
import type { FormatTemplate } from './schema.js';
import { getFormatTemplate } from './templates.js';
import { validateFormat } from './validate.js';

/**
 * Replays of real tournaments (issue #19): official results from Liquipedia go through the
 * engine, and the outcomes must match what happened. See fixtures/replays/README.md.
 */

const dir = fileURLToPath(new URL('../../fixtures/replays/', import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

interface Fixture {
  event: string;
  game: string;
  liquipedia: string;
  checkedOn: string;
  template?: { id: string; version: number };
  format?: unknown;
  teams: Record<string, string>;
  stages: Record<string, { results: unknown; expected?: unknown; unscored?: Sourced[] }>;
}

type Sourced = SeriesResult & { source?: string };

/** Every series object anywhere in the results: anything with team1, team2 and scores. */
function allSeries(value: unknown, found: Sourced[] = []): Sourced[] {
  if (Array.isArray(value)) value.forEach((v) => allSeries(v, found));
  else if (value && typeof value === 'object') {
    if ('team1' in value && 'score1' in value) found.push(value as Sourced);
    else Object.values(value).forEach((v) => allSeries(v, found));
  }
  return found;
}

function templateOf(fixture: Fixture): FormatTemplate {
  if (fixture.template) {
    const template = getFormatTemplate(fixture.template.id);
    if (!template) throw new Error(`no template ${fixture.template.id}`);
    expect(template.version).toBe(fixture.template.version);
    return template;
  }
  const validation = validateFormat(fixture.format);
  expect(validation.ok ? [] : validation.issues).toEqual([]);
  return (validation as { ok: true; template: FormatTemplate }).template;
}

const winnerOf = (s: SeriesResult) => s.winner ?? (s.score1 > s.score2 ? s.team1 : s.team2);

it('has fixtures to replay', () => {
  expect(files.length).toBeGreaterThanOrEqual(8);
});

describe.each(files)('%s', (file) => {
  const fixture = JSON.parse(readFileSync(`${dir}${file}`, 'utf8')) as Fixture;
  const template = templateOf(fixture);

  it('names its event and validates against its template', () => {
    expect(fixture.game).toBe(template.game);
    expect(fixture.liquipedia).toMatch(/^https:\/\/liquipedia\.net\//);
    expect(fixture.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('gives every series a source and uses only listed teams', () => {
    const series = Object.values(fixture.stages).flatMap((s) => [
      ...allSeries(s.results),
      ...(s.unscored ?? []),
    ]);
    expect(series.length).toBeGreaterThan(0);
    for (const s of series) {
      expect(s.source, `${s.team1} vs ${s.team2}`).toMatch(/^https:\/\/liquipedia\.net\//);
      expect(Object.keys(fixture.teams)).toContain(s.team1);
      expect(Object.keys(fixture.teams)).toContain(s.team2);
    }
  });

  for (const [stageId, { results, expected }] of Object.entries(fixture.stages)) {
    const stage = template.stages.find((s) => s.id === stageId);

    it(`replays ${stageId} without differences`, () => {
      expect(stage, `template ${template.id} has no stage ${stageId}`).toBeDefined();
      switch (stage!.kind) {
        case 'swiss': {
          const outcome = swissOutcome(stage!, results as SwissResults);
          expect(outcome.issues).toEqual([]);
          expect(outcome.complete).toBe(true);
          const want = expected as {
            records: Record<string, string>;
            buckets: Record<string, string[]>;
          };
          expect(Object.fromEntries(outcome.teams.map((t) => [t.team, t.record]))).toEqual(
            want.records,
          );
          const buckets: Record<string, string[]> = {};
          for (const t of outcome.teams) (buckets[t.bucket!] ??= []).push(t.team);
          for (const [bucket, teams] of Object.entries(want.buckets)) {
            expect([...(buckets[bucket] ?? [])].sort(), bucket).toEqual([...teams].sort());
          }
          break;
        }
        case 'bracket': {
          const outcome = bracketOutcome(stage!, results as BracketResults);
          expect(outcome.issues).toEqual([]);
          expect(outcome.complete).toBe(true);
          const want = expected as {
            champion: string;
            winners: Record<string, string>;
            placements: { team: string; from: number; to: number }[];
          };
          expect(outcome.champion).toBe(want.champion);
          expect(Object.fromEntries(outcome.slots.map((s) => [s.id, s.winner]))).toEqual(
            want.winners,
          );
          const sort = (rows: { team: string; from: number; to: number }[]) =>
            [...rows].sort((a, b) => a.from - b.from || a.team.localeCompare(b.team));
          expect(sort(outcome.placements)).toEqual(sort(want.placements));
          break;
        }
        case 'gsl': {
          const want = expected as Record<
            string,
            Record<'first' | 'second' | 'third' | 'fourth', string>
          >;
          for (const group of results as GslGroupResults[]) {
            const outcome = gslGroupOutcome(stage!, group);
            expect(outcome.issues).toEqual([]);
            expect(outcome.complete).toBe(true);
            const { first, second, third, fourth } = outcome;
            expect({ first, second, third, fourth }, `group ${group.group}`).toEqual(
              want[group.group],
            );
          }
          break;
        }
        case 'round-robin': {
          const want = expected as Record<string, { qualifiers: string[]; winner: string }>;
          for (const group of results as RoundRobinGroupResults[]) {
            const outcome = roundRobinGroupOutcome(stage!, group);
            expect(outcome.issues).toEqual([]);
            expect(outcome.needsOrder).toBe(false);
            expect(outcome.complete).toBe(true);
            expect(outcome.qualifiers, `group ${group.group}`).toEqual(
              want[group.group]!.qualifiers,
            );
            expect(outcome.winner).toBe(want[group.group]!.winner);
          }
          break;
        }
        case 'not-predicted': {
          // Kept so bracket positions can be checked: every series has a winner.
          for (const s of allSeries(results)) expect(winnerOf(s)).toBeTruthy();
          expect(expected).toBeUndefined();
          break;
        }
      }
    });
  }
});
