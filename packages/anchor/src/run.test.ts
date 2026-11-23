import { createRequire } from 'node:module';
import { Keypair } from '@solana/web3.js';
import { describe, expect, it, vi } from 'vitest';
import { MEMO_PROGRAM_ID, explorerUrl, keypairFromJson, memoInstruction } from './anchor.js';
import { run, type Deps } from './run.js';

const vectors = createRequire(import.meta.url)(
  '@bracket-oracle/engine/roots/test-vectors.json',
) as {
  cases: { name: string; leaves: { contest: string }[]; root: string }[];
};
const five = vectors.cases.find((c) => c.leaves.length === 5)!;
const contest = five.leaves[0]!.contest;
const signer = Keypair.generate();
const keypairJson = JSON.stringify(Array.from(signer.secretKey));
const signature = '5'.repeat(88);

function deps(files: Record<string, string> = {}, env: Deps['env'] = {}) {
  const send = vi.fn<Deps['send']>(async (_rpc, key, memo) => ({
    memo: `bracket-oracle:entries-root:v1:${memo.contest}:${memo.root}:${memo.count}`,
    signer: key.publicKey.toBase58(),
    signature,
  }));
  const read = async (path: string) => {
    const file = files[path];
    if (file === undefined) throw new Error(`ENOENT: ${path}`);
    return file;
  };
  return { send, deps: { read, env, send } satisfies Deps };
}

describe('memo instruction', () => {
  it('targets SPL Memo v2 and lists the signer, so the memo program checks the signature', () => {
    const ix = memoInstruction('hello', signer.publicKey);
    expect(ix.programId.toBase58()).toBe('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
    expect(ix.programId.equals(MEMO_PROGRAM_ID)).toBe(true);
    expect(ix.keys).toEqual([{ pubkey: signer.publicKey, isSigner: true, isWritable: false }]);
    expect(Buffer.from(ix.data).toString('utf8')).toBe('hello');
  });
});

describe('explorer links', () => {
  it.each([
    ['https://api.devnet.solana.com', '?cluster=devnet'],
    ['https://api.testnet.solana.com', '?cluster=testnet'],
    ['https://api.mainnet-beta.solana.com', ''],
    ['http://127.0.0.1:8899', '?cluster=custom&customUrl=http%3A%2F%2F127.0.0.1%3A8899'],
  ])('%s', (rpc, query) => {
    expect(explorerUrl('sig', rpc)).toBe(`https://explorer.solana.com/tx/sig${query}`);
  });
});

describe('keypair files', () => {
  it('reads a solana-keygen array', () => {
    expect(keypairFromJson(keypairJson).publicKey.equals(signer.publicKey)).toBe(true);
  });

  it.each([['{}'], ['[1,2,3]'], [JSON.stringify(Array(64).fill('x'))]])('refuses %s', (json) => {
    expect(() => keypairFromJson(json)).toThrow(/64 bytes/);
  });
});

describe('bracket-oracle-anchor', () => {
  it('prints the usage without a root or leaves', async () => {
    const result = await run([], deps().deps);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('Usage: bracket-oracle-anchor');
  });

  it('recomputes the root from published leaves', async () => {
    const { deps: d } = deps({ 'leaves.json': JSON.stringify({ leaves: five.leaves }) });
    const result = await run(['--leaves', 'leaves.json', '--dry-run'], d);
    expect(result).toEqual({
      code: 0,
      stdout: `memo: bracket-oracle:entries-root:v1:${contest}:${five.root}:5\ndry run: nothing sent`,
      stderr: '',
    });
  });

  it('refuses a root that the leaves do not give', async () => {
    const { deps: d } = deps({ 'leaves.json': JSON.stringify(five.leaves) });
    const result = await run(['--leaves', 'leaves.json', '--root', 'f'.repeat(64), '--dry-run'], d);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain(`does not match the leaves, which give ${five.root}`);
  });

  it('refuses a count that is not a whole number', async () => {
    const args = ['--contest', 'c1', '--root', five.root, '--count', '1.5', '--dry-run'];
    const result = await run(args, deps().deps);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('--count must be a whole number');
  });

  it('refuses a malformed root before sending', async () => {
    const { send, deps: d } = deps({ 'key.json': keypairJson });
    const args = ['--contest', 'c1', '--root', 'xyz', '--count', '3', '--keypair', 'key.json'];
    const result = await run(args, d);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('64 lowercase hex');
    expect(send).not.toHaveBeenCalled();
  });

  it('needs a keypair to send', async () => {
    const result = await run(['--contest', 'c1', '--root', five.root, '--count', '5'], deps().deps);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('--keypair is required');
  });

  it('sends the memo to devnet by default and prints the explorer link', async () => {
    const { send, deps: d } = deps({ 'key.json': keypairJson });
    const args = [
      '--contest',
      contest,
      '--root',
      five.root,
      '--count',
      '5',
      '--keypair',
      'key.json',
    ];
    const result = await run([...args, '--json'], d);
    expect(result.code).toBe(0);
    expect(send).toHaveBeenCalledWith(
      'https://api.devnet.solana.com',
      expect.objectContaining({ publicKey: signer.publicKey }),
      { contest, root: five.root, count: 5 },
    );
    expect(JSON.parse(result.stdout)).toMatchObject({
      contest,
      root: five.root,
      count: 5,
      signature,
      signer: signer.publicKey.toBase58(),
      explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
      sent: true,
    });
  });

  it('takes the RPC from SOLANA_RPC_URL when --rpc is absent', async () => {
    const { send, deps: d } = deps(
      { 'key.json': keypairJson },
      { SOLANA_RPC_URL: 'http://127.0.0.1:8899' },
    );
    await run(['--contest', 'c1', '--root', five.root, '--count', '5', '--keypair', 'key.json'], d);
    expect(send.mock.calls[0]![0]).toBe('http://127.0.0.1:8899');
  });

  it('reports a failed transaction', async () => {
    const { send, deps: d } = deps({ 'key.json': keypairJson });
    send.mockRejectedValueOnce(new Error('Blockhash not found'));
    const args = ['--contest', 'c1', '--root', five.root, '--count', '5', '--keypair', 'key.json'];
    const result = await run(args, d);
    expect(result).toEqual({
      code: 1,
      stdout: '',
      stderr: 'Anchoring failed: Blockhash not found',
    });
  });
});
