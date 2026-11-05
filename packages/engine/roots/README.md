# Merkle roots

At lock, Bracket Oracle fixes the entries of a contest in one merkle root: one leaf per entry with
the prediction that counts. Stage 3 writes the root on-chain, so nobody, the platform included, can
change a bracket after lock. Anyone can rebuild the root from the published leaves, and every
player can prove that their entry is in it. The payouts root at settle (stage 4) uses the same
tree.

## Tree

| Part     | Format                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------- |
| Leaf     | `SHA-256(0x00 ‖ leaf bytes)`                                                                                              |
| Node     | `SHA-256(0x01 ‖ a ‖ b)`, with the two 32-byte child hashes in byte order, smaller first                                   |
| Levels   | Hashes are paired left to right; when a level has an odd count, its last hash moves up unchanged (it is never duplicated) |
| One leaf | The root is that leaf's hash                                                                                              |
| No leaf  | The root is SHA-256 of the empty byte string, `e3b0c442…b855`                                                             |
| Proof    | The sibling hashes from the leaf up to the root; fold them with the node rule                                             |

The `0x00` and `0x01` prefixes keep leaf data from passing for a node. A verifier must hash the leaf
bytes itself and never accept a 32-byte leaf hash from someone else. Because each pair is sorted,
a proof carries no left or right flags. The Anchor program can check a proof with the SHA-256
syscall and a loop:

```text
hash = SHA-256(0x00 ‖ leaf bytes)
for sibling in proof:
    hash = SHA-256(0x01 ‖ min(hash, sibling) ‖ max(hash, sibling))
valid = (hash == root)
```

## Entry leaves

A leaf is the canonical JSON (sorted keys, no whitespace, UTF-8) of:

```json
{
  "contest": "ti-2026-bracket",
  "entry": "entry-1",
  "kind": "entry",
  "prediction": "<SHA-256 of the prediction document, the hash the wallet signed>",
  "revision": 3,
  "wallet": "<the Solana address that signed, base58>"
}
```

`revision` is the save that counts: the last one before lock. Leaves are sorted by `entry`, which is
unique within a contest; a root covers exactly one contest. Entries without a saved prediction have
no leaf.

## Test vectors

`test-vectors.json` lists five cases (no entries, one, two, three and five) with every leaf's
bytes, hash and proof, and the root. `generate-test-vectors.py` builds the file with Python's
standard library alone, and the engine's tests check that the engine reproduces it.

```bash
python3 packages/engine/roots/generate-test-vectors.py > packages/engine/roots/test-vectors.json
```

## Check a root or a proof yourself

```bash
node packages/verify/dist/cli.js roots leaves.json
```

- `{ "leaves": [...] }` prints the entries root. Add `"root"` to compare it with a published root,
  and `"entry"` to print that entry's proof.
- `{ "leaf": {...}, "proof": [...], "root": "..." }` checks a proof. The leaf hash is computed from
  the leaf, never taken as given.
