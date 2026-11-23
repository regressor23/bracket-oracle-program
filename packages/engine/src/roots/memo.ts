import { entityIdSchema } from '../predictions/schema.js';
import { MerkleError } from './merkle.js';

/**
 * Until stage 3 records the entries root inside a pool account, the platform anchors it on Solana
 * as an SPL Memo: one transaction per contest, sent right after lock and signed by the platform's
 * anchoring key. The memo is plain ASCII so explorers show it as is:
 *
 *   bracket-oracle:entries-root:v1:<contest>:<root>:<count>
 *
 * `root` is the 64-character lowercase hex root from `entriesRoot`, and `count` is the number of
 * leaves (entries frozen at lock). Contest ids cannot contain a colon, so the fields split cleanly.
 */
export const ENTRIES_ROOT_MEMO_PREFIX = 'bracket-oracle:entries-root:v1';

export interface EntriesRootMemo {
  contest: string;
  root: string;
  count: number;
}

const ROOT = /^[0-9a-f]{64}$/;
const COUNT = /^(0|[1-9][0-9]{0,8})$/;

function check(memo: EntriesRootMemo): EntriesRootMemo {
  if (!entityIdSchema.safeParse(memo.contest).success) {
    throw new MerkleError(`contest "${memo.contest}" is not a valid id`);
  }
  if (!ROOT.test(memo.root)) throw new MerkleError('root must be 64 lowercase hex characters');
  if (!Number.isInteger(memo.count) || memo.count < 0 || memo.count > 999_999_999) {
    throw new MerkleError('count must be a whole number of entries');
  }
  return memo;
}

/** The memo text that anchors one contest's entries root. */
export function entriesRootMemo(memo: EntriesRootMemo): string {
  const { contest, root, count } = check(memo);
  return `${ENTRIES_ROOT_MEMO_PREFIX}:${contest}:${root}:${count}`;
}

/** Reads an anchoring memo back; returns null for any other memo text. */
export function parseEntriesRootMemo(text: string): EntriesRootMemo | null {
  if (!text.startsWith(`${ENTRIES_ROOT_MEMO_PREFIX}:`)) return null;
  const fields = text.slice(ENTRIES_ROOT_MEMO_PREFIX.length + 1).split(':');
  if (fields.length !== 3) return null;
  const [contest, root, count] = fields as [string, string, string];
  if (!COUNT.test(count)) return null;
  try {
    return check({ contest, root, count: Number(count) });
  } catch {
    return null;
  }
}
