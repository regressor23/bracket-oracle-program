import { utf8ToBytes } from '@noble/hashes/utils.js';
import { z } from 'zod';
import { canonicalJson } from '../canonical.js';
import { entityIdSchema } from '../predictions/schema.js';
import { leafHash, merkleProof, merkleTree, MerkleError } from './merkle.js';
/**
 * The entries root (issue #25): at lock, one leaf per entry of the contest with the prediction
 * that counts, so no bracket can change afterwards. Stage 3 writes the root on-chain; anyone can
 * rebuild it from the published leaves, and a player can prove their entry is in it.
 *
 * A leaf is the canonical JSON of `{ kind: "entry", contest, entry, wallet, revision,
 * prediction }`, hashed as a merkle leaf. Leaves are sorted by entry id, which is unique.
 */
export const entryLeafSchema = z.strictObject({
    contest: entityIdSchema,
    entry: entityIdSchema,
    /** The Solana address that signed the prediction, base58. */
    wallet: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'a base58 Solana address'),
    /** The saved revision that counts: the last one before lock. */
    revision: z.int().min(1),
    /** SHA-256 of the prediction document's canonical JSON, the hash the wallet signed. */
    prediction: z.string().regex(/^[0-9a-f]{64}$/, '64 lowercase hex characters'),
});
/** The exact bytes of a leaf: canonical JSON with `kind` set, UTF-8 encoded. */
export function entryLeafBytes(leaf) {
    return utf8ToBytes(canonicalJson({ kind: 'entry', ...leaf }));
}
export function entryLeafHash(leaf) {
    return leafHash(entryLeafBytes(leaf));
}
/**
 * The entries root of one contest. Every leaf is checked, all must name the same contest, and an
 * entry may appear once.
 */
export function entriesRoot(input) {
    const leaves = input.map((raw, i) => {
        const parsed = entryLeafSchema.safeParse(raw);
        if (!parsed.success) {
            const issue = parsed.error.issues[0];
            throw new MerkleError(`leaf ${i}: ${issue.path.join('.') || '<root>'}: ${issue.message}`);
        }
        return parsed.data;
    });
    const contests = new Set(leaves.map((l) => l.contest));
    if (contests.size > 1) {
        throw new MerkleError(`leaves of ${contests.size} contests; a root covers one contest`);
    }
    const sorted = [...leaves].sort((a, b) => (a.entry < b.entry ? -1 : a.entry > b.entry ? 1 : 0));
    for (let i = 1; i < sorted.length; i += 1) {
        if (sorted[i].entry === sorted[i - 1].entry) {
            throw new MerkleError(`entry ${sorted[i].entry} appears more than once`);
        }
    }
    const hashed = sorted.map((leaf) => ({ leaf, hash: entryLeafHash(leaf) }));
    const tree = merkleTree(hashed.map((l) => l.hash));
    return { root: tree.root, leaves: hashed, tree };
}
/** The proof that one entry is in the contest's entries root. */
export function entryProof(root, entry) {
    const index = root.leaves.findIndex((l) => l.leaf.entry === entry);
    if (index < 0)
        throw new MerkleError(`entry ${entry} is not in this root`);
    const { leaf, hash } = root.leaves[index];
    return { root: root.root, leaf, hash, proof: merkleProof(root.tree, index) };
}
//# sourceMappingURL=entries.js.map