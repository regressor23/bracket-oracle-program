#!/usr/bin/env python3
"""Test vectors for the entries root, computed without the engine (Python standard library only).

The engine's tests check that it reproduces these numbers, and the Anchor program's tests can use
the same file. Run from the repository root:

    python3 packages/engine/roots/generate-test-vectors.py > packages/engine/roots/test-vectors.json
"""
import hashlib
import json

LEAF, NODE = b"\x00", b"\x01"


def canonical(value):
    # Same output as the engine's canonicalJson for objects of strings and integers.
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def leaf_hash(leaf):
    text = canonical({"kind": "entry", **leaf})
    return text, hashlib.sha256(LEAF + text.encode("utf-8")).hexdigest()


def node_hash(a, b):
    first, second = sorted([a, b])
    return hashlib.sha256(NODE + bytes.fromhex(first) + bytes.fromhex(second)).hexdigest()


def tree(hashes):
    if not hashes:
        return [[]], hashlib.sha256(b"").hexdigest()
    levels = [list(hashes)]
    while len(levels[-1]) > 1:
        level = levels[-1]
        levels.append(
            [node_hash(level[i], level[i + 1]) if i + 1 < len(level) else level[i]
             for i in range(0, len(level), 2)]
        )
    return levels, levels[-1][0]


def proof(levels, index):
    out = []
    for level in levels[:-1]:
        sibling = index + 1 if index % 2 == 0 else index - 1
        if sibling < len(level):
            out.append(level[sibling])
        index //= 2
    return out


WALLETS = [
    "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T",
    "DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy",
    "HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH",
]


def leaf(i, revision):
    return {
        "contest": "ti-2026-bracket",
        "entry": f"entry-{i}",
        "wallet": WALLETS[i - 1],
        "revision": revision,
        "prediction": hashlib.sha256(f"prediction {i} revision {revision}".encode()).hexdigest(),
    }


cases = []
for name, leaves in [
    ("no entries", []),
    ("one entry", [leaf(1, 1)]),
    ("two entries", [leaf(2, 1), leaf(1, 3)]),
    ("three entries: the odd hash moves up", [leaf(3, 2), leaf(1, 1), leaf(2, 1)]),
    ("five entries, given out of order", [leaf(4, 1), leaf(2, 5), leaf(5, 2), leaf(1, 1), leaf(3, 1)]),
]:
    ordered = sorted(leaves, key=lambda l: l["entry"])
    hashed = [leaf_hash(l) for l in ordered]
    levels, root = tree([h for _, h in hashed])
    cases.append({
        "name": name,
        "leaves": leaves,
        "tree": [
            {"entry": l["entry"], "bytes": text, "hash": h, "proof": proof(levels, i)}
            for i, (l, (text, h)) in enumerate(zip(ordered, hashed))
        ],
        "root": root,
    })

print(json.dumps({
    "description": "Entries root test vectors: leaf = SHA-256(0x00 || canonical JSON), "
                   "node = SHA-256(0x01 || smaller || larger), odd hashes move up.",
    "cases": cases,
}, indent=2, ensure_ascii=False))
