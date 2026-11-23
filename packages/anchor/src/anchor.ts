import {
  entriesRoot,
  entriesRootMemo,
  parseEntriesRootMemo,
  type EntriesRootMemo,
} from '@bracket-oracle/engine';
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  type Connection,
} from '@solana/web3.js';

/** SPL Memo v2: logs the memo and checks that every listed account signed the transaction. */
export const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export const DEVNET_RPC = 'https://api.devnet.solana.com';

/** What to anchor: published leaves (the root is recomputed), or a root the platform reported. */
export interface RootSource {
  contest?: string;
  root?: string;
  count?: number;
  leaves?: unknown[];
}

/**
 * Settles the memo for one contest. With leaves, the root and count come from the engine and any
 * contest, root or count given alongside must agree with them.
 */
export function resolveMemo(source: RootSource): EntriesRootMemo {
  if (source.leaves !== undefined) {
    const computed = entriesRoot(source.leaves);
    const contest = computed.leaves[0]?.leaf.contest ?? source.contest;
    if (!contest) throw new Error('an empty list of leaves needs "contest"');
    if (source.contest !== undefined && source.contest !== contest) {
      throw new Error(`the leaves belong to contest ${contest}, not ${source.contest}`);
    }
    if (source.root !== undefined && source.root !== computed.root) {
      throw new Error(`root ${source.root} does not match the leaves, which give ${computed.root}`);
    }
    const count = computed.leaves.length;
    if (source.count !== undefined && source.count !== count) {
      throw new Error(`count ${source.count} does not match the ${count} leaves`);
    }
    return { contest, root: computed.root, count };
  }
  const { contest, root, count } = source;
  if (contest === undefined || root === undefined || count === undefined) {
    throw new Error('pass the leaves, or the contest, root and count');
  }
  const memo = { contest, root, count };
  entriesRootMemo(memo); // throws on a malformed contest id, root or count
  return memo;
}

/** A memo instruction that names the signer, so the memo program checks the signature. */
export function memoInstruction(text: string, signer: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
    data: Buffer.from(text, 'utf8'),
  });
}

export interface Anchored {
  memo: string;
  signer: string;
  signature: string;
}

/** Sends one memo transaction with the contest's entries root and waits for confirmation. */
export async function anchorRoot(
  connection: Connection,
  signer: Keypair,
  memo: EntriesRootMemo,
): Promise<Anchored> {
  const text = entriesRootMemo(memo);
  if (!parseEntriesRootMemo(text)) throw new Error(`memo "${text}" does not read back`);
  const transaction = new Transaction().add(memoInstruction(text, signer.publicKey));
  const signature = await sendAndConfirmTransaction(connection, transaction, [signer], {
    commitment: 'confirmed',
  });
  return { memo: text, signer: signer.publicKey.toBase58(), signature };
}

/** Solana Explorer link for a transaction on the cluster behind the RPC URL. */
export function explorerUrl(signature: string, rpc: string): string {
  const base = `https://explorer.solana.com/tx/${signature}`;
  const host = new URL(rpc).hostname;
  if (host.includes('devnet')) return `${base}?cluster=devnet`;
  if (host.includes('testnet')) return `${base}?cluster=testnet`;
  if (host === 'localhost' || host === '127.0.0.1') {
    return `${base}?cluster=custom&customUrl=${encodeURIComponent(rpc)}`;
  }
  return base;
}

/** A keypair file written by `solana-keygen`: a JSON array of 64 bytes. */
export function keypairFromJson(json: string): Keypair {
  const bytes = JSON.parse(json) as unknown;
  if (!Array.isArray(bytes) || bytes.length !== 64 || !bytes.every((b) => Number.isInteger(b))) {
    throw new Error('the keypair file must hold a JSON array of 64 bytes');
  }
  return Keypair.fromSecretKey(Uint8Array.from(bytes as number[]));
}
