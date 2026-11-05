import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../hash.js';
import { entriesRoot, entryLeafBytes, entryProof, type EntryLeaf } from './entries.js';
import {
  EMPTY_ROOT,
  MerkleError,
  leafHash,
  merkleProof,
  merkleTree,
  nodeHash,
  verifyProof,
} from './merkle.js';

/**
 * The vectors in `roots/test-vectors.json` come from `roots/generate-test-vectors.py`, which uses
 * only Python's standard library, so these tests check the engine against a second, independent
 * implementation of the same format.
 */
const vectors = JSON.parse(
  readFileSync(new URL('../../roots/test-vectors.json', import.meta.url), 'utf8'),
) as {
  cases: {
    name: string;
    leaves: EntryLeaf[];
    tree: { entry: string; bytes: string; hash: string; proof: string[] }[];
    root: string;
  }[];
};

describe('entries root test vectors', () => {
  it.each(vectors.cases.map((c) => [c.name, c] as const))('%s', (_, vector) => {
    const root = entriesRoot(vector.leaves);
    expect(root.root).toBe(vector.root);
    expect(root.leaves.map((l) => l.leaf.entry)).toEqual(vector.tree.map((t) => t.entry));
    for (const [i, expected] of vector.tree.entries()) {
      const leaf = root.leaves[i]!.leaf;
      expect(new TextDecoder().decode(entryLeafBytes(leaf))).toBe(expected.bytes);
      expect(root.leaves[i]!.hash).toBe(expected.hash);
      const proof = entryProof(root, expected.entry);
      expect(proof.proof).toEqual(expected.proof);
      expect(verifyProof(proof.hash, proof.proof, root.root)).toBe(true);
    }
  });
});

describe('merkle tree', () => {
  const hashes = Array.from({ length: 7 }, (_, i) => sha256Hex(`leaf ${i}`));

  it('has the empty root for no leaves and the leaf itself for one', () => {
    expect(merkleTree([]).root).toBe(EMPTY_ROOT);
    expect(EMPTY_ROOT).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(merkleTree([hashes[0]!]).root).toBe(hashes[0]);
  });

  it('hashes a pair the same in either order', () => {
    expect(nodeHash(hashes[0]!, hashes[1]!)).toBe(nodeHash(hashes[1]!, hashes[0]!));
  });

  it('proves every leaf of trees of every size up to seven', () => {
    for (let size = 1; size <= hashes.length; size += 1) {
      const tree = merkleTree(hashes.slice(0, size));
      for (let i = 0; i < size; i += 1) {
        expect(verifyProof(hashes[i]!, merkleProof(tree, i), tree.root)).toBe(true);
      }
    }
  });

  it('rejects a changed leaf or a changed proof', () => {
    const tree = merkleTree(hashes.slice(0, 4));
    const proof = merkleProof(tree, 1);
    expect(verifyProof(sha256Hex('other'), proof, tree.root)).toBe(false);
    expect(verifyProof(hashes[1]!, [sha256Hex('other'), ...proof.slice(1)], tree.root)).toBe(false);
    expect(verifyProof('not a hash', proof, tree.root)).toBe(false);
  });

  it('keeps leaf data from passing for a node', () => {
    // The two children of a node, hashed as leaf data, do not give the node's hash: the 0x00 and
    // 0x01 prefixes differ. So a verifier that hashes the leaf bytes itself cannot be handed a
    // node instead of a leaf.
    const [a, b] = [hashes[0]!, hashes[1]!].sort();
    const children = new Uint8Array(64);
    children.set(Buffer.from(a!, 'hex'), 0);
    children.set(Buffer.from(b!, 'hex'), 32);
    expect(leafHash(children)).not.toBe(nodeHash(a!, b!));
  });

  it('refuses bad hashes and indexes', () => {
    expect(() => merkleTree(['abc'])).toThrow(MerkleError);
    expect(() => merkleProof(merkleTree(hashes), 7)).toThrow('no leaf at index 7');
  });
});

describe('entriesRoot', () => {
  const leaf = (entry: string, contest = 'c'): EntryLeaf => ({
    contest,
    entry,
    wallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    revision: 1,
    prediction: sha256Hex(entry),
  });

  it('gives the same root whatever order the entries come in', () => {
    const a = entriesRoot([leaf('a'), leaf('b'), leaf('c')]);
    const b = entriesRoot([leaf('c'), leaf('a'), leaf('b')]);
    expect(a.root).toBe(b.root);
  });

  it('changes the root when any prediction changes', () => {
    const before = entriesRoot([leaf('a'), leaf('b')]).root;
    const changed = { ...leaf('b'), prediction: sha256Hex('another bracket') };
    expect(entriesRoot([leaf('a'), changed]).root).not.toBe(before);
    expect(entriesRoot([leaf('a'), { ...leaf('b'), revision: 2 }]).root).not.toBe(before);
  });

  it('refuses duplicate entries, mixed contests and malformed leaves', () => {
    expect(() => entriesRoot([leaf('a'), leaf('a')])).toThrow('entry a appears more than once');
    expect(() => entriesRoot([leaf('a'), leaf('b', 'other')])).toThrow('leaves of 2 contests');
    expect(() => entriesRoot([{ ...leaf('a'), wallet: '0x12' }])).toThrow(/^leaf 0: wallet: /);
    expect(() => entryProof(entriesRoot([leaf('a')]), 'z')).toThrow('entry z is not in this root');
  });
});
