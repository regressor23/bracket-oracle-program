import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { run, type RpcCall } from './run.js';

const vectors = createRequire(import.meta.url)(
  '@bracket-oracle/engine/roots/test-vectors.json',
) as {
  cases: { leaves: { contest: string; entry: string }[]; root: string }[];
};
const five = vectors.cases.find((c) => c.leaves.length === 5)!;
const contest = five.leaves[0]!.contest;
const signer = 'BrAcKeTsigner1111111111111111111111111111111';
const signature = '3'.repeat(88);
const memo = `bracket-oracle:entries-root:v1:${contest}:${five.root}:5`;

/** The shape getTransaction returns with encoding jsonParsed for a memo transaction. */
function transaction(overrides: { memo?: string; err?: unknown; signers?: string[] } = {}) {
  const signers = overrides.signers ?? [signer];
  return {
    slot: 431_000_123,
    blockTime: 1_796_335_200,
    meta: { err: overrides.err ?? null, fee: 5000 },
    transaction: {
      signatures: [signature],
      message: {
        accountKeys: [
          ...signers.map((pubkey) => ({
            pubkey,
            signer: true,
            writable: true,
            source: 'transaction',
          })),
          {
            pubkey: 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
            signer: false,
            writable: false,
            source: 'transaction',
          },
        ],
        instructions: [
          {
            parsed: overrides.memo ?? memo,
            program: 'spl-memo',
            programId: 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
            stackHeight: null,
          },
        ],
      },
    },
  };
}

function check(input: Record<string, unknown>, tx: unknown = transaction()) {
  const call = vi.fn<RpcCall>(async () => tx);
  const read = async () => JSON.stringify({ signature, ...input });
  return { call, result: run(['onchain', 'anchored.json'], read, call) };
}

describe('bracket-oracle-verify onchain', () => {
  it('asks the devnet RPC for the parsed, confirmed transaction', async () => {
    const { call, result } = check({ root: five.root });
    await result;
    expect(call).toHaveBeenCalledWith('https://api.devnet.solana.com', 'getTransaction', [
      signature,
      { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 },
    ]);
  });

  it('uses the RPC given in the file', async () => {
    const { call, result } = check({ root: five.root, rpc: 'http://127.0.0.1:8899' });
    await result;
    expect(call.mock.calls[0]![0]).toBe('http://127.0.0.1:8899');
  });

  it('recomputes the root from the leaves and finds it anchored', async () => {
    const { result } = check({ leaves: five.leaves, signer });
    expect(await result).toEqual({
      code: 0,
      stdout: [
        `transaction ${signature}: slot 431000123 at 2026-12-03T22:00:00.000Z`,
        `signed by ${signer}`,
        `anchored: contest ${contest}, root ${five.root}, 5 entries`,
        `leaves: root ${five.root}, 5 entries`,
        'matches the anchored root',
      ].join('\n'),
      stderr: '',
    });
  });

  it('catches a leaf that changed after the root was anchored', async () => {
    const leaves = five.leaves.map((l, i) => (i === 2 ? { ...l, revision: 99 } : l));
    const { result } = check({ leaves });
    const { code, stderr } = await result;
    expect(code).toBe(1);
    expect(stderr).toBe('does not match the anchored root');
  });

  it('compares a reported root, contest and count', async () => {
    const { result } = check({ root: five.root, contest: 'other', count: 4 });
    const { code, stderr } = await result;
    expect(code).toBe(1);
    expect(stderr).toBe('does not match the anchored contest, count');
  });

  it('flags a transaction signed by someone else', async () => {
    const { result } = check({
      root: five.root,
      signer: 'SomeoneElse11111111111111111111111111111111',
    });
    const { code, stderr } = await result;
    expect(code).toBe(1);
    expect(stderr).toBe('not signed by SomeoneElse11111111111111111111111111111111');
  });

  it('flags a failed transaction', async () => {
    const { result } = check(
      { root: five.root },
      transaction({ err: { InstructionError: [0, 'X'] } }),
    );
    const { code, stderr } = await result;
    expect(code).toBe(1);
    expect(stderr).toContain('the transaction failed');
  });

  it('flags a transaction without an entries-root memo', async () => {
    const { result } = check({ root: five.root }, transaction({ memo: 'gm' }));
    const { code, stderr } = await result;
    expect(code).toBe(1);
    expect(stderr).toBe('expected one entries-root memo, found 0');
  });

  it('reports a transaction the RPC does not know', async () => {
    const { result } = check({ root: five.root }, null);
    expect(await result).toEqual({
      code: 1,
      stdout: '',
      stderr: `transaction ${signature} was not found`,
    });
  });

  it('reports RPC failures', async () => {
    const call = vi.fn<RpcCall>(async () => {
      throw new Error('RPC answered HTTP 429');
    });
    const read = async () => JSON.stringify({ signature, root: five.root });
    expect(await run(['onchain', 'a.json'], read, call)).toEqual({
      code: 1,
      stdout: '',
      stderr: 'Cannot check a.json on-chain: RPC answered HTTP 429',
    });
  });

  it('needs a signature', async () => {
    const read = async () => JSON.stringify({ root: five.root });
    const { code, stderr } = await run(['onchain', 'a.json'], read, vi.fn<RpcCall>());
    expect(code).toBe(1);
    expect(stderr).toContain('expected "signature"');
  });
});
