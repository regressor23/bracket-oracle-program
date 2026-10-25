import { readFile } from 'node:fs/promises';
import {
  ENGINE_VERSION,
  hashCanonical,
  maxBasePoints,
  maxExactScoreBonus,
  pickCount,
  roundStage,
  validateFormat,
  type CanonicalValue,
  type FormatTemplate,
} from '@bracket-oracle/engine';

export const USAGE = `Usage: bracket-oracle-verify <command>

Commands:
  hash <file.json>     Print the canonical SHA-256 of a JSON file (bracket, results or payouts)
  format <file.json>   Check a format template and print its hash, picks and maximum points
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
    default:
      return { code: command ? 2 : 0, stdout: command ? '' : USAGE, stderr: command ? USAGE : '' };
  }
}
