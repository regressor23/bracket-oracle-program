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
export declare const LEAF_PREFIX = 0;
export declare const NODE_PREFIX = 1;
/** The root of a tree with no leaves: SHA-256 of the empty byte string. */
export declare const EMPTY_ROOT: string;
export declare class MerkleError extends Error {
    constructor(message: string);
}
/** SHA-256(0x00 || bytes) as lowercase hex. */
export declare function leafHash(bytes: Uint8Array): string;
/** SHA-256(0x01 || smaller || larger) of two hashes, as lowercase hex. */
export declare function nodeHash(a: string, b: string): string;
export interface MerkleTree {
    root: string;
    /** Every level from the leaves (level 0) up to the root. */
    levels: string[][];
}
/** Builds the tree over leaf hashes in the order given. */
export declare function merkleTree(leaves: readonly string[]): MerkleTree;
/** The sibling hashes from the leaf at `index` up to the root. */
export declare function merkleProof(tree: MerkleTree, index: number): string[];
/** True when the leaf hash and the proof lead to the root. Never throws on bad input. */
export declare function verifyProof(leaf: string, proof: readonly string[], root: string): boolean;
//# sourceMappingURL=merkle.d.ts.map