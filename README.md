# Bracket Oracle — program, engine and verifier

[Bracket Oracle](https://x.com/BracketOracle) runs bracket predictions for tier-1 Dota 2, CS2 and
LoL tournaments, with free pools and USDC pools on Solana.

This repository is public on purpose: everything needed to check a pool's result without trusting
us lives here.

| Path                      | What                                                                    |
| ------------------------- | ----------------------------------------------------------------------- |
| `programs/bracket_oracle` | Anchor program that holds pool funds and settles them by merkle root    |
| `packages/engine`         | Canonical JSON and hashing today; formats, scoring and payouts next     |
| `packages/verify`         | `bracket-oracle-verify` CLI: recompute hashes (and soon roots) yourself |

## How verification will work

1. Every saved bracket is canonical JSON signed by the player; its SHA-256 is the receipt.
2. At lock, the program records the merkle root of all brackets in the pool.
3. After the round, the engine in this repository scores every bracket from public results and
   computes payouts; the program records the payouts root, settled by a 2-of-3 multisig.
4. Anyone can download the published JSON, run `bracket-oracle-verify`, and compare both roots
   with the values on-chain.

Status: stage 0 skeleton. The program has a single `initialize_config` instruction; pools,
entries, settlement and claims arrive in stage 3.

## Develop

```bash
pnpm install && pnpm test && pnpm build   # engine and verify CLI (Node.js 22)
cargo test                                # program logic on the host
anchor build                              # SBF build (Agave CLI + Anchor 1.2.1)
```

```bash
node packages/verify/dist/cli.js hash my-bracket.json
```

## Security

Please report vulnerabilities privately — see [SECURITY.md](SECURITY.md).

## License

Not chosen yet. Until a `LICENSE` file is added, all rights are reserved.
