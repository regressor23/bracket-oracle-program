# Replay fixtures

Real tier-1 tournaments with their official results, replayed through the engine
(`src/formats/replays.test.ts`). Each fixture is one event: its template, its teams, every series
of the predicted stages with its score and a source link, and the outcomes that actually
happened. The test computes every stage from the series and fails on any difference, so a change
to the engine or a template that would score a past event differently is caught before release.

Results were read on Liquipedia on 3 November 2026. Each series links to the page it was read
from.

The fixtures ship with the package from v0.4.1 as
`@bracket-oracle/engine/fixtures/replays/<file>.json`. The platform reads the same files in its
acceptance test, where the events that have recorded PandaScore answers also go through import,
polling and confirmation before their outcomes are compared.

| File                                  | Event                          | Stages replayed                                   | What it covers                                                      |
| ------------------------------------- | ------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------- |
| `ti-2026.json`                        | The International 2026         | Swiss to 4 wins with elimination round; 8-team DE | Elimination-round buckets; the Bo5 grand final                      |
| `pgl-wallachia-s9.json`               | PGL Wallachia Season 9         | Swiss to 3 wins; 8-team DE                        | 3-0 / advance / eliminated / 0-3 buckets                            |
| `blast-slam-8.json`                   | BLAST Slam VIII                | Four GSL groups; 6-team DE                        | GSL places; bracket where positions 1 and 4 skip a round            |
| `msi-2026.json`                       | 2026 Mid-Season Invitational   | 8-team DE, all Bo5                                | Bo5 throughout; 3-2 series                                          |
| `iem-cologne-major-2026.json`         | IEM Cologne Major 2026         | Stage 3 Swiss, all Bo3; 8-team SE                 | `cs2-major` version 2                                               |
| `starladder-budapest-major-2025.json` | StarLadder Budapest Major 2025 | Stage 3 Swiss, Bo1 and Bo3; 8-team SE             | `cs2-major` version 1, Bo1 series; stand-in for Singapore 2026      |
| `iem-krakow-2026.json`                | IEM Kraków 2026                | 6-team SE with byes                               | Teams entering in the semifinals; a third-place match outside slots |
| `dreamleague-s28.json`                | DreamLeague Season 28          | Two round-robin groups, Bo2; 4-team DE            | Bo2 draws, a tiebreaker series, an admin order; lower-bracket start |

Still to add: the 2026 World Championship (final on 14 November) and PGL Major Singapore 2026
(final on 13 December), which replaces Budapest 2025 as the CS2 Major of the set. No 2026 tier-1
event in the three games had a grand final with a bracket reset; the engine's unit tests cover
resets.

## Shape

```jsonc
{
  "event": "The International 2026",
  "game": "dota2",
  "liquipedia": "https://liquipedia.net/dota2/The_International/2026",
  "checkedOn": "2026-11-03",
  // Either a launch template by id and version…
  "template": { "id": "ti", "version": 1 },
  // …or a whole template, for events no launch template describes.
  // "format": { … },
  "notes": ["Anything a reviewer should know: renamed teams, tiebreak rules, extra matches."],
  "teams": { "team-spirit": "Team Spirit" },
  "stages": {
    "<stage id from the template>": {
      "results": {}, // the engine's input for the stage kind, every series with a "source" link
      "expected": {}, // what happened; see below
      "unscored": [], // series the organizer played outside the template, kept for the record
    },
  },
}
```

`results` is exactly what the engine takes: `SwissResults`, `BracketResults`, a list of
`GslGroupResults` or a list of `RoundRobinGroupResults`. Series carry two extra fields the engine
ignores: `source`, and `rounds` for a CS2 Bo1, whose map score in rounds is stored as 1-0.

`expected` by stage kind:

- Swiss: `records` (team → "wins-losses") and `buckets` (bucket id → teams).
- Bracket: `champion`, `winners` (slot id → team) and `placements`, where shared places are a
  range (`from` 5, `to` 6).
- GSL: per group, `first`, `second`, `third` and `fourth`.
- Round-robin: per group, `qualifiers` in order and the `winner`.

Not-predicted stages may list their series under `results` with no `expected`, so the bracket
positions can be traced back (BLAST Slam seeding and last-chance matches).

## Adding an event

1. Read the stage pages on Liquipedia once the event is over.
2. Write the fixture with series in the template's slot order and a `source` on every series.
3. Take `expected` from Liquipedia's standings and bracket, not from the engine.
4. Run `pnpm --filter @bracket-oracle/engine test`. A difference is either a data mistake or a
   real gap in the engine or the template; never edit `expected` to make the test pass.
