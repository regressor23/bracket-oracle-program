import { z } from 'zod';
import { type MerkleTree } from './merkle.js';
/**
 * The entries root (issue #25): at lock, one leaf per entry of the contest with the prediction
 * that counts, so no bracket can change afterwards. Stage 3 writes the root on-chain; anyone can
 * rebuild it from the published leaves, and a player can prove their entry is in it.
 *
 * A leaf is the canonical JSON of `{ kind: "entry", contest, entry, wallet, revision,
 * prediction }`, hashed as a merkle leaf. Leaves are sorted by entry id, which is unique.
 */
export declare const entryLeafSchema: z.ZodObject<{
    contest: z.ZodString;
    entry: z.ZodString;
    wallet: z.ZodString;
    revision: z.ZodInt;
    prediction: z.ZodString;
}, z.core.$strict>;
export type EntryLeaf = z.infer<typeof entryLeafSchema>;
/** The exact bytes of a leaf: canonical JSON with `kind` set, UTF-8 encoded. */
export declare function entryLeafBytes(leaf: EntryLeaf): Uint8Array;
export declare function entryLeafHash(leaf: EntryLeaf): string;
export interface EntriesRoot {
    root: string;
    /** The leaves in tree order, with their hashes. */
    leaves: {
        leaf: EntryLeaf;
        hash: string;
    }[];
    tree: MerkleTree;
}
/**
 * The entries root of one contest. Every leaf is checked, all must name the same contest, and an
 * entry may appear once.
 */
export declare function entriesRoot(input: readonly unknown[]): EntriesRoot;
export interface EntryProof {
    root: string;
    leaf: EntryLeaf;
    hash: string;
    /** Sibling hashes from the leaf up to the root. */
    proof: string[];
}
/** The proof that one entry is in the contest's entries root. */
export declare function entryProof(root: EntriesRoot, entry: string): EntryProof;
//# sourceMappingURL=entries.d.ts.map