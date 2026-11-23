import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { entriesRootMemo, type EntriesRootMemo } from '@bracket-oracle/engine';
import { Connection, type Keypair } from '@solana/web3.js';
import {
  DEVNET_RPC,
  anchorRoot,
  explorerUrl,
  keypairFromJson,
  resolveMemo,
  type Anchored,
  type RootSource,
} from './anchor.js';

export const USAGE = `Usage: bracket-oracle-anchor [options]

Anchors a contest's entries root on Solana as an SPL Memo transaction.

What to anchor, one of:
  --leaves <file.json>   published leaves, as an array or { "leaves": [...] }; the root is recomputed
  --contest <id> --root <hex> --count <n>
                         a root the platform recorded at lock

Options:
  --keypair <file.json>  signer and fee payer, a solana-keygen file (required unless --dry-run)
  --rpc <url>            RPC endpoint (default: $SOLANA_RPC_URL, else ${DEVNET_RPC})
  --dry-run              print the memo and send nothing
  --json                 print the result as JSON`;

export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface Deps {
  read: (path: string) => Promise<string>;
  env: Record<string, string | undefined>;
  send: (rpc: string, signer: Keypair, memo: EntriesRootMemo) => Promise<Anchored>;
}

const defaultDeps: Deps = {
  read: (path) => readFile(path, 'utf8'),
  env: process.env,
  send: (rpc, signer, memo) => anchorRoot(new Connection(rpc, 'confirmed'), signer, memo),
};

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function rootSource(
  values: { leaves?: string; contest?: string; root?: string; count?: string },
  read: Deps['read'],
): Promise<RootSource> {
  let count: number | undefined;
  if (values.count !== undefined) {
    if (!/^(0|[1-9][0-9]*)$/.test(values.count)) {
      throw new Error(`--count must be a whole number, got "${values.count}"`);
    }
    count = Number(values.count);
  }
  const source: RootSource = { contest: values.contest, root: values.root, count };
  if (values.leaves !== undefined) {
    const parsed = JSON.parse(await read(values.leaves)) as unknown;
    const leaves = Array.isArray(parsed) ? parsed : (parsed as { leaves?: unknown }).leaves;
    if (!Array.isArray(leaves)) throw new Error(`${values.leaves} has no "leaves" array`);
    source.leaves = leaves;
  }
  return source;
}

export async function run(args: string[], deps: Deps = defaultDeps): Promise<CliResult> {
  let values;
  try {
    ({ values } = parseArgs({
      args,
      strict: true,
      allowPositionals: false,
      options: {
        leaves: { type: 'string' },
        contest: { type: 'string' },
        root: { type: 'string' },
        count: { type: 'string' },
        keypair: { type: 'string' },
        rpc: { type: 'string' },
        'dry-run': { type: 'boolean', default: false },
        json: { type: 'boolean', default: false },
        help: { type: 'boolean', default: false },
      },
    }));
  } catch (error) {
    return { code: 2, stdout: '', stderr: `${message(error)}\n\n${USAGE}` };
  }
  if (values.help) return { code: 0, stdout: USAGE, stderr: '' };
  if (values.leaves === undefined && values.root === undefined) {
    return { code: 2, stdout: '', stderr: USAGE };
  }

  let memo: EntriesRootMemo;
  try {
    memo = resolveMemo(await rootSource(values, deps.read));
  } catch (error) {
    return { code: 1, stdout: '', stderr: `Cannot anchor: ${message(error)}` };
  }
  const text = entriesRootMemo(memo);
  if (values['dry-run']) {
    const stdout = values.json
      ? JSON.stringify({ memo: text, ...memo, sent: false })
      : `memo: ${text}\ndry run: nothing sent`;
    return { code: 0, stdout, stderr: '' };
  }
  if (values.keypair === undefined) {
    return { code: 2, stdout: '', stderr: `--keypair is required to send\n\n${USAGE}` };
  }

  const rpc = values.rpc ?? deps.env['SOLANA_RPC_URL'] ?? DEVNET_RPC;
  try {
    const signer = keypairFromJson(await deps.read(values.keypair));
    const anchored = await deps.send(rpc, signer, memo);
    const explorer = explorerUrl(anchored.signature, rpc);
    const stdout = values.json
      ? JSON.stringify({ ...anchored, ...memo, explorer, sent: true })
      : [
          `memo: ${anchored.memo}`,
          `signer: ${anchored.signer}`,
          `signature: ${anchored.signature}`,
          `explorer: ${explorer}`,
        ].join('\n');
    return { code: 0, stdout, stderr: '' };
  } catch (error) {
    return { code: 1, stdout: '', stderr: `Anchoring failed: ${message(error)}` };
  }
}
