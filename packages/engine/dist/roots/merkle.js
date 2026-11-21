import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
/**
 * The merkle tree behind every published root (ADR-09): entries at lock (issue #25) and, from
 * stage 4, payouts at settle. Small and fixed so the Anchor program can check the same proofs.
 *
 * - A leaf hash is SHA-256(0x00 || leaf bytes). A node hash is SHA-256(0x01 || a || b), where a
 *   and b are the two child hashes in byte order, smaller first. The prefixes keep a leaf from
 *   passing for a node; the sorted pair means a proof is just the list of sibling hashes.
 * - Leaves are paired left to right in the order given; a level with an odd count carries its
 *   last hash up unchanged (never duplicated).
 * - The root of one leaf is that leaf's hash. The root of no leaves is SHA-256 of nothing.
 *
 * Stable forever: changing any rule changes every published root.
 */
export const LEAF_PREFIX = 0x00;
export const NODE_PREFIX = 0x01;
/** The root of a tree with no leaves: SHA-256 of the empty byte string. */
export const EMPTY_ROOT = bytesToHex(sha256(new Uint8Array(0)));
const HASH = /^[0-9a-f]{64}$/;
export class MerkleError extends Error {
    constructor(message) {
        super(message);
        this.name = 'MerkleError';
    }
}
function bytesOf(hash) {
    if (!HASH.test(hash))
        throw new MerkleError(`"${hash}" is not 64 lowercase hex characters`);
    return hexToBytes(hash);
}
/** SHA-256(0x00 || bytes) as lowercase hex. */
export function leafHash(bytes) {
    const input = new Uint8Array(bytes.length + 1);
    input[0] = LEAF_PREFIX;
    input.set(bytes, 1);
    return bytesToHex(sha256(input));
}
/** SHA-256(0x01 || smaller || larger) of two hashes, as lowercase hex. */
export function nodeHash(a, b) {
    const [first, second] = a <= b ? [a, b] : [b, a];
    const input = new Uint8Array(65);
    input[0] = NODE_PREFIX;
    input.set(bytesOf(first), 1);
    input.set(bytesOf(second), 33);
    return bytesToHex(sha256(input));
}
/** Builds the tree over leaf hashes in the order given. */
export function merkleTree(leaves) {
    leaves.forEach(bytesOf);
    if (leaves.length === 0)
        return { root: EMPTY_ROOT, levels: [[]] };
    const levels = [[...leaves]];
    while (levels.at(-1).length > 1) {
        const level = levels.at(-1);
        const next = [];
        for (let i = 0; i < level.length; i += 2) {
            next.push(i + 1 < level.length ? nodeHash(level[i], level[i + 1]) : level[i]);
        }
        levels.push(next);
    }
    return { root: levels.at(-1)[0], levels };
}
/** The sibling hashes from the leaf at `index` up to the root. */
export function merkleProof(tree, index) {
    const leaves = tree.levels[0];
    if (!Number.isInteger(index) || index < 0 || index >= leaves.length) {
        throw new MerkleError(`no leaf at index ${index}`);
    }
    const proof = [];
    let position = index;
    for (const level of tree.levels.slice(0, -1)) {
        const sibling = position % 2 === 0 ? position + 1 : position - 1;
        // The last hash of an odd level has no sibling: it moves up as it is.
        if (sibling < level.length)
            proof.push(level[sibling]);
        position = Math.floor(position / 2);
    }
    return proof;
}
/** True when the leaf hash and the proof lead to the root. Never throws on bad input. */
export function verifyProof(leaf, proof, root) {
    if (!HASH.test(leaf) || !HASH.test(root) || !proof.every((h) => HASH.test(h)))
        return false;
    return proof.reduce((hash, sibling) => nodeHash(hash, sibling), leaf) === root;
}
//# sourceMappingURL=merkle.js.map