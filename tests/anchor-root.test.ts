import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { anchorRoot, keypairFromJson, resolveMemo } from '@bracket-oracle/anchor';
import { Connection } from '@solana/web3.js';
import { describe, expect, it } from 'vitest';

// Runs through `anchor test` like initialize-config.test.ts: ANCHOR_PROVIDER_URL points at the
// local validator, which ships SPL Memo, and ANCHOR_WALLET is a throwaway funded at genesis.
const rpc = process.env['ANCHOR_PROVIDER_URL'] ?? 'http://127.0.0.1:8899';
const walletPath = process.env['ANCHOR_WALLET'];
if (!walletPath) throw new Error('ANCHOR_WALLET is not set; run these tests through anchor test');
const wallet = keypairFromJson(readFileSync(walletPath, 'utf8'));
const connection = new Connection(rpc, 'confirmed');

const vectors = createRequire(import.meta.url)(
  '@bracket-oracle/engine/roots/test-vectors.json',
) as {
  cases: { leaves: Record<string, unknown>[]; root: string }[];
};
const five = vectors.cases.find((c) => c.leaves.length === 5)!;

const verifyCli = fileURLToPath(new URL('../packages/verify/dist/cli.js', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'anchor-root-'));

/** Runs the published verify CLI, the way anyone would check an anchored root. */
function verify(input: Record<string, unknown>) {
  const file = join(dir, `check-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(file, JSON.stringify(input));
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    execFile(process.execPath, [verifyCli, 'onchain', file], (error, stdout, stderr) => {
      resolve({ code: error ? Number(error.code ?? 1) : 0, stdout, stderr });
    });
  });
}

describe('anchoring an entries root on a local validator', () => {
  it('writes the memo, and the verify CLI recomputes the same root from the leaves', async () => {
    const memo = resolveMemo({ leaves: five.leaves });
    expect(memo.root).toBe(five.root);

    const anchored = await anchorRoot(connection, wallet, memo);
    expect(anchored.memo).toBe(`bracket-oracle:entries-root:v1:${memo.contest}:${five.root}:5`);

    const ok = await verify({
      signature: anchored.signature,
      rpc,
      signer: wallet.publicKey.toBase58(),
      leaves: five.leaves,
    });
    expect(ok.stderr).toBe('');
    expect(ok.code).toBe(0);
    expect(ok.stdout).toContain(`signed by ${wallet.publicKey.toBase58()}`);
    expect(ok.stdout).toContain('matches the anchored root');

    const changed = five.leaves.map((leaf, i) => (i === 0 ? { ...leaf, revision: 42 } : leaf));
    const tampered = await verify({ signature: anchored.signature, rpc, leaves: changed });
    expect(tampered.code).toBe(1);
    expect(tampered.stderr).toContain('does not match the anchored root');
  });
});
