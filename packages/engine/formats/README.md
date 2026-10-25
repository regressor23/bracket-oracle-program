# Format templates

Every tournament on Bracket Oracle starts from one of these templates. A template lists the stages
of the event, which stage each round predicts, the slots of the bracket and the points for every
pick. Pools are scored with exactly these numbers; an admin may change the points for one
tournament only before its round opens, and the changed copy is published with the round.

| File                 | Event                                | Groups round                   | Bracket round                         |
| -------------------- | ------------------------------------ | ------------------------------ | ------------------------------------- |
| `ti.json`            | The International                    | Swiss to 4 wins, 16 teams: 190 | Double elimination, 8 teams: 195      |
| `pgl-wallachia.json` | PGL Wallachia                        | Swiss to 3 wins, 16 teams: 180 | Double elimination, 8 teams: 195      |
| `blast-slam.json`    | BLAST Slam                           | Four GSL groups: 80            | Double elimination, 6 teams: 165      |
| `cs2-major.json`     | CS2 Major                            | Stage 3, Swiss, 16 teams: 180  | Single elimination, 8 teams: 120      |
| `lol-worlds.json`    | League of Legends World Championship | Swiss stage, 16 teams: 180     | Single elimination, 8 teams: 120      |
| `lol-msi.json`       | Mid-Season Invitational              | None (play-in not predicted)   | Double elimination, 8 teams, Bo5: 195 |

Numbers are the most base points a perfect prediction earns, before the exact-score bonus (+5 for
a Bo3, +10 for a Bo5) and the underdog multiplier. Each template's `reference` names the edition it
was checked against on Liquipedia.

`format.schema.json` is the JSON Schema (draft 2020-12) of a template. It covers the shape; the
engine's `validateFormat` also checks the slot wiring, the Swiss records behind every bucket and
the bucket sizes. Check any template yourself:

```bash
node packages/verify/dist/cli.js format packages/engine/formats/ti.json
```

## How slots work

Bracket slots name where each team comes from: a starting position (`position`, numbered from the
top of the bracket), or the winner or loser of an earlier slot (`winnerOf`, `loserOf`). The same
edges appear in PandaScore's `previous_matches`, so an imported bracket can be matched to its
template by shape. A pick is the winner of a slot; picked losers drop to the lower bracket on
their own.

## Changing a template

Edit `src/formats/templates.ts`, bump the template's `version`, then regenerate the files:

```bash
pnpm --filter @bracket-oracle/engine formats:export
```

A test fails while these files differ from the code.
