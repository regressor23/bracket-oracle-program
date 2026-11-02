# Bracket Oracle — program, engine and verifier

[Bracket Oracle](https://x.com/BracketOracle) runs bracket predictions for tier-1 Dota 2, CS2 and
LoL tournaments, with free pools and USDC pools on Solana.

This repository is public on purpose: everything needed to check a pool's result without trusting
us lives here.

| Path                      | What                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| `programs/bracket_oracle` | Anchor program that holds pool funds and settles them by merkle root                              |
| `packages/engine`         | Canonical JSON, hashing and [format templates](packages/engine/formats); scoring and payouts next |
| `packages/verify`         | `bracket-oracle-verify` CLI: recompute hashes, check formats (and soon roots) yourself            |
| `tests`                   | Integration tests that run the program on a local validator                                       |

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
anchor test --skip-build --validator legacy   # initialize_config on a local validator
```

```bash
node packages/verify/dist/cli.js hash my-bracket.json
node packages/verify/dist/cli.js format packages/engine/formats/ti.json
```

## Releasing the engine

The private monorepo installs `@bracket-oracle/engine` straight from a tag of this repository
(`github:regressor23/bracket-oracle-program#v<version>&path:packages/engine`), so a release is a tag,
not an npm publish.

1. Bump `version` in `packages/engine/package.json` and `ENGINE_VERSION` in
   `packages/engine/src/index.ts` together; CI fails when they differ.
2. Merge to `main`.
3. Run **Release engine** from the Actions tab. It checks the versions, builds and tests the engine,
   commits `packages/engine/dist` on top of `main` and pushes the tag `v<version>` pointing at that
   commit. An existing tag is never moved.
4. In the monorepo, change the tag in the pnpm catalog and update the lockfile.

## Devnet

Program address: `8RDMewh6hyF8dhHxsKDZZrhjnqkymtxLyHnHZaADciLv`
([Solana Explorer](https://explorer.solana.com/address/8RDMewh6hyF8dhHxsKDZZrhjnqkymtxLyHnHZaADciLv?cluster=devnet)).

Deploys run only from `main`, through the manual **Deploy to devnet** workflow (Actions → Deploy to
devnet → Run workflow). It builds the program, checks that the program keypair matches
`declare_id!`, checks the deployer balance and deploys; the first run creates the program, later
runs upgrade it. The workflow reads two repository secrets that never enter this repository:

| Secret                    | What                                                        |
| ------------------------- | ----------------------------------------------------------- |
| `DEVNET_DEPLOYER_KEYPAIR` | Pays for the deploy and stays the program upgrade authority |
| `DEVNET_PROGRAM_KEYPAIR`  | Keypair of the program address above                        |

Both hold the JSON array written by `solana-keygen`. Fund the deployer with devnet SOL at
[faucet.solana.com](https://faucet.solana.com). These are devnet-only keys; mainnet keys never go
through CI, and mainnet upgrades will go through a Squads multisig.

## Security

Please report vulnerabilities privately — see [SECURITY.md](SECURITY.md).

## License

Not chosen yet. Until a `LICENSE` file is added, all rights are reserved.
