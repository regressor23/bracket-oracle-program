import { readFile } from 'node:fs/promises';
import { ENGINE_VERSION, hashCanonical, type CanonicalValue } from '@bracket-oracle/engine';

export const USAGE = `Usage: bracket-oracle-verify <command>

Commands:
  hash <file.json>   Print the canonical SHA-256 of a JSON file (bracket, results or payouts)
  version            Print the engine version used for verification

Coming with stage 3: roots <pool.json> — recompute the entries and payouts merkle roots
and compare them with the values recorded on-chain.`;

export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
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
    default:
      return { code: command ? 2 : 0, stdout: command ? '' : USAGE, stderr: command ? USAGE : '' };
  }
}
