import { describe, expect, it } from 'vitest';
import { entriesRoot } from './entries.js';
import { MerkleError } from './merkle.js';
import { ENTRIES_ROOT_MEMO_PREFIX, entriesRootMemo, parseEntriesRootMemo } from './memo.js';

const root = 'a'.repeat(64);

describe('entries root memo', () => {
  it('writes the contest, root and count after the versioned prefix', () => {
    expect(entriesRootMemo({ contest: 'warm-up-cs2-groups', root, count: 12 })).toBe(
      `bracket-oracle:entries-root:v1:warm-up-cs2-groups:${root}:12`,
    );
  });

  it('round-trips through parseEntriesRootMemo', () => {
    const memo = { contest: '0ddd7031-996b-48ce-ab09-fe3b5a01523b', root, count: 0 };
    expect(parseEntriesRootMemo(entriesRootMemo(memo))).toEqual(memo);
  });

  it('anchors the root that entriesRoot computes, with its leaf count', () => {
    const leaves = ['b', 'a'].map((entry, i) => ({
      contest: 'c1',
      entry,
      wallet: '11111111111111111111111111111111',
      revision: i + 1,
      prediction: String(i).repeat(64),
    }));
    const computed = entriesRoot(leaves);
    const text = entriesRootMemo({ contest: 'c1', root: computed.root, count: 2 });
    expect(parseEntriesRootMemo(text)).toEqual({ contest: 'c1', root: computed.root, count: 2 });
  });

  it.each([
    ['an id with a colon', { contest: 'a:b', root, count: 1 }, /not a valid id/],
    ['an uppercase root', { contest: 'c1', root: 'A'.repeat(64), count: 1 }, /64 lowercase hex/],
    ['a short root', { contest: 'c1', root: 'a'.repeat(63), count: 1 }, /64 lowercase hex/],
    ['a negative count', { contest: 'c1', root, count: -1 }, /whole number/],
    ['a fractional count', { contest: 'c1', root, count: 1.5 }, /whole number/],
  ])('refuses %s', (_name, memo, message) => {
    expect(() => entriesRootMemo(memo)).toThrow(MerkleError);
    expect(() => entriesRootMemo(memo)).toThrow(message);
  });

  it.each([
    ['another memo', 'gm'],
    ['another version', `bracket-oracle:entries-root:v2:c1:${root}:1`],
    ['a missing count', `${ENTRIES_ROOT_MEMO_PREFIX}:c1:${root}`],
    ['an extra field', `${ENTRIES_ROOT_MEMO_PREFIX}:c1:${root}:1:x`],
    ['a count with a leading zero', `${ENTRIES_ROOT_MEMO_PREFIX}:c1:${root}:01`],
    ['a count with a sign', `${ENTRIES_ROOT_MEMO_PREFIX}:c1:${root}:+1`],
    ['an invalid contest id', `${ENTRIES_ROOT_MEMO_PREFIX}:-c1:${root}:1`],
  ])('ignores %s', (_name, text) => {
    expect(parseEntriesRootMemo(text)).toBeNull();
  });
});
