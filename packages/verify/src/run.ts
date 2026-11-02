import { readFile } from 'node:fs/promises';
import {
  ENGINE_VERSION,
  bracketOutcome,
  getFormatTemplate,
  gslGroupOutcome,
  hashCanonical,
  maxBasePoints,
  maxExactScoreBonus,
  pickCount,
  roundRobinGroupOutcome,
  roundStage,
  swissOutcome,
  validateFormat,
  type BracketResults,
  type CanonicalValue,
  type FormatTemplate,
  type GslGroupResults,
  type OutcomeIssue,
  type RoundRobinGroupResults,
  type SwissResults,
} from '@bracket-oracle/engine';

export const USAGE = `Usage: bracket-oracle-verify <command>

Commands:
  hash <file.json>     Print the canonical SHA-256 of a JSON file (bracket, results or payouts)
  format <file.json>   Check a format template and print its hash, picks and maximum points
  outcomes <file.json> Print a stage's outcomes from official results:
                       { "format": "<template id>" or a template, "stage": "<stage id>",
                         "results": bracket, Swiss or { "groups": [...] } results }
  version              Print the engine version used for verification

Coming with stage 3: roots <pool.json> — recompute the entries and payouts merkle roots
and compare them with the values recorded on-chain.`;

export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

function describeFormat(template: FormatTemplate): string {
  const lines = [
    `${template.id} v${template.version} (${template.game}): valid`,
    `sha256 ${hashCanonical(template as unknown as CanonicalValue)}`,
  ];
  for (const round of ['groups', 'bracket'] as const) {
    const stage = roundStage(template, round);
    if (!stage) continue;
    const bonus = maxExactScoreBonus(stage);
    lines.push(
      `${round}: ${stage.id}, ${pickCount(stage)} picks, up to ${maxBasePoints(stage)} points` +
        (bonus > 0 ? ` (+${bonus} for exact scores)` : ''),
    );
  }
  return lines.join('\n');
}

interface OutcomesInput {
  format: string | FormatTemplate;
  stage: string;
  results: unknown;
}

/** Prints the outcome of one stage; issues go to stderr and make the exit code 1. */
function describeOutcomes(input: OutcomesInput): { lines: string[]; issues: OutcomeIssue[] } {
  const template =
    typeof input.format === 'string' ? getFormatTemplate(input.format) : input.format;
  if (!template) throw new Error(`unknown format template "${String(input.format)}"`);
  const stage = template.stages.find((s) => s.id === input.stage);
  if (!stage) throw new Error(`${template.id} has no stage "${input.stage}"`);
  const lines = [`${template.id} v${template.version}, ${stage.id} (${stage.kind})`];

  switch (stage.kind) {
    case 'bracket': {
      const outcome = bracketOutcome(stage, input.results as BracketResults);
      for (const slot of outcome.slots) {
        const score = slot.score ? ` ${slot.score[0]}-${slot.score[1]}` : '';
        const winner = slot.winner ? ` → ${slot.winner}${slot.forfeit ? ' (forfeit)' : ''}` : '';
        lines.push(`${slot.id}: ${slot.top ?? '?'} vs ${slot.bottom ?? '?'}${score}${winner}`);
      }
      lines.push(`champion: ${outcome.champion ?? 'not decided'}`);
      for (const p of outcome.placements) {
        lines.push(`${p.from === p.to ? p.from : `${p.from}-${p.to}`}: ${p.team}`);
      }
      return { lines, issues: outcome.issues };
    }
    case 'swiss': {
      const outcome = swissOutcome(stage, input.results as SwissResults);
      for (const team of outcome.teams) {
        const extra = team.eliminationRound ? `, elimination round ${team.eliminationRound}` : '';
        lines.push(`${team.team}: ${team.record}${extra} → ${team.bucket ?? 'not decided'}`);
      }
      return { lines, issues: outcome.issues };
    }
    case 'gsl': {
      const issues: OutcomeIssue[] = [];
      for (const group of (input.results as { groups: GslGroupResults[] }).groups) {
        const o = gslGroupOutcome(stage, group);
        issues.push(...o.issues);
        lines.push(
          `group ${o.group}: 1. ${o.first ?? '?'}, 2. ${o.second ?? '?'}, 3. ${o.third ?? '?'}, 4. ${o.fourth ?? '?'}`,
        );
      }
      return { lines, issues };
    }
    case 'round-robin': {
      const issues: OutcomeIssue[] = [];
      for (const group of (input.results as { groups: RoundRobinGroupResults[] }).groups) {
        const o = roundRobinGroupOutcome(stage, group);
        issues.push(...o.issues);
        lines.push(`group ${o.group}:`);
        for (const r of o.table) {
          lines.push(
            `  ${r.rank}. ${r.team} ${r.wins}-${r.draws}-${r.losses}, maps ${r.mapsWon}-${r.mapsLost}, ${r.points} pts`,
          );
        }
        lines.push(
          o.needsOrder
            ? '  a tie decides the group: the admin sets the order'
            : `  advance: ${o.qualifiers?.join(', ') ?? 'not decided'}`,
        );
      }
      return { lines, issues };
    }
    default:
      throw new Error(`${stage.id} is not predicted, so it has no outcomes`);
  }
}

async function readJson(file: string, read: (path: string) => Promise<string>): Promise<unknown> {
  return JSON.parse(await read(file)) as unknown;
}

export async function run(
  args: string[],
  read: (path: string) => Promise<string> = (path) => readFile(path, 'utf8'),
): Promise<CliResult> {
  const [command, file] = args;
  switch (command) {
    case 'version':
      return { code: 0, stdout: ENGINE_VERSION, stderr: '' };
    case 'hash': {
      if (!file) return { code: 2, stdout: '', stderr: USAGE };
      try {
        const value = JSON.parse(await read(file)) as CanonicalValue;
        return { code: 0, stdout: hashCanonical(value), stderr: '' };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { code: 1, stdout: '', stderr: `Cannot hash ${file}: ${message}` };
      }
    }
    case 'format': {
      if (!file) return { code: 2, stdout: '', stderr: USAGE };
      try {
        const result = validateFormat(await readJson(file, read));
        if (result.ok) return { code: 0, stdout: describeFormat(result.template), stderr: '' };
        const issues = result.issues.map((issue) => `  ${issue.path}: ${issue.message}`);
        return {
          code: 1,
          stdout: '',
          stderr: [`${file} is not a valid format:`, ...issues].join('\n'),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { code: 1, stdout: '', stderr: `Cannot read ${file}: ${message}` };
      }
    }
    case 'outcomes': {
      if (!file) return { code: 2, stdout: '', stderr: USAGE };
      try {
        const { lines, issues } = describeOutcomes((await readJson(file, read)) as OutcomesInput);
        const stderr = issues.map((i) => `${i.at}: ${i.message}`).join('\n');
        return { code: issues.length > 0 ? 1 : 0, stdout: lines.join('\n'), stderr };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { code: 1, stdout: '', stderr: `Cannot compute outcomes from ${file}: ${message}` };
      }
    }
    default:
      return { code: command ? 2 : 0, stdout: command ? '' : USAGE, stderr: command ? USAGE : '' };
  }
}
