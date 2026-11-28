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
| `packages/anchor`         | `bracket-oracle-anchor` CLI: anchor a contest's entries root on Solana as an SPL Memo             |
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

## Anchoring entries roots today

Until stage 3 records the entries root inside a pool account, the root of every contest is anchored
on Solana devnet right after lock, as one SPL Memo transaction signed by the platform key:

```text
bracket-oracle:entries-root:v1:<contest>:<root>:<count>
```

The memo format lives in the engine (`entriesRootMemo`, `parseEntriesRootMemo`). Anyone can read
an anchored root back and compare it with the values the platform reports:

```bash
# anchored.json: { "signature": "<transaction>", "contest": "<id>", "root": "<hex>", "count": <n> }
node packages/verify/dist/cli.js onchain anchored.json
```

The command reads the transaction from devnet (or from `"rpc"`), checks that it succeeded and who
signed it (`"signer"`), and compares root, contest and entry count. Given `"leaves"` instead, it
recomputes the root from them. The leaves of live rounds are not published yet; they will be, with
the USDC pools of stage 3. Until then the whole round trip, leaves included, runs in CI on a local
validator (`tests/anchor-root.test.ts`).

Roots are anchored by hand from Actions → **Anchor entries root**, with the contest id, root and
entry count the platform recorded at lock; the job signs with the devnet deployer key and reads the
root back with the verify CLI. Locally:

```bash
node packages/anchor/dist/cli.js --leaves leaves.json --dry-run          # print the memo
node packages/anchor/dist/cli.js --contest <id> --root <hex> --count <n> \
  --keypair ~/.config/solana/devnet.json --rpc https://api.devnet.solana.com
```

## Dev3pack Global Hackathon, 27–29 November 2026

Bracket Oracle is our submission. Players call a whole tier-1 Dota 2, CS2 or LoL bracket before the
first match, sign it with their Solana wallet and climb a leaderboard; USDC pools come next. The web
app (Next.js, Fastify API, BullMQ worker) lives in a private repository. This repository holds
everything needed to check a result without trusting us.

Live app: https://bracket-oracleweb-staging.up.railway.app, where the free test on the CS2 Major
runs in December.

Demo video (2:45): https://www.youtube.com/watch?v=WUKwOveWRLo

**Built before the hackathon (October – November 2026)**

- Anchor program skeleton (`initialize_config`) on devnet, with CI and a manual deploy workflow.
- Engine 0.1 – 0.6: canonical JSON and SHA-256 receipts; format templates for The International,
  CS2 Majors, BLAST Slam, PGL Wallachia, LoL Worlds and MSI; prediction documents the player's
  wallet signs; scoring, tie-breaks and ranking; the entries merkle root at lock.
- `bracket-oracle-verify`: hashes, formats, outcomes, scores and roots from published JSON.
- In the private app: sign-in with email, Google or a Solana wallet; wallet-signed brackets with
  server receipts; the entries root computed at every lock; live leaderboards; push reminders.

**Built for the hackathon (from 23 November 2026)**

- The Apache-2.0 licence.
- Engine 0.7.0: the entries-root memo format.
- `packages/anchor` and the **Anchor entries root** workflow: the root at lock goes to Solana devnet
  as an SPL Memo signed by the platform key.
- `bracket-oracle-verify onchain`: reads that transaction back and recomputes the root.
- An integration test of the whole round trip on a local validator in CI.

**Anchored on devnet**

The first roots anchored this way come from the two rounds of the warm-up test on staging (the CS2
Major template), locked on 27 November 2026. Both transactions are signed by the devnet deployer
`UUT3oQsGLf31VdpT9yGhH6rh2jMWH1MjyZ5oGhTCPEC`, and the workflow read each one back with
`bracket-oracle-verify onchain`.

| Round   | Contest                                | Entries | Transaction                                                                                                                                         |
| ------- | -------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Groups  | `c7aec749-0bd5-46df-a705-2e2ce2faaacf` | 3       | [53rx5wyx…](https://explorer.solana.com/tx/53rx5wyxB1QKoUCrQbP1pP1JE5nhKoNTJRU2Nj7SMVofRSL7rEqAGJRxP5QonXv1Vjx3rhXxDuKaEqM35wMPMRKL?cluster=devnet) |
| Bracket | `13c9e6d4-3d4c-42f0-8440-3def20ab85f7` | 1       | [f2Ykz4qN…](https://explorer.solana.com/tx/f2Ykz4qNpJaSQcyVAnkYDzTywbgcRWvJzdVvnTn9n8xshFRgM617aSybzcWRSMLAAwPbXf4hp7TU9YxsEJWYyac?cluster=devnet)  |

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

Copyright 2026 the Bracket Oracle authors. Licensed under the [Apache License, Version 2.0](LICENSE):
the program, the engine, the verify CLI and the tests in this repository may be used, changed and
redistributed under its terms.
