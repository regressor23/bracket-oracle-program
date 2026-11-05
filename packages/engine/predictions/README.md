# Prediction documents

A prediction is what a player saves for one round of a tournament: the winner of every bracket slot,
or the bucket of every Swiss team, or the places in every group. Bracket Oracle stores it as
canonical JSON (sorted keys, no whitespace), the player's wallet signs its SHA-256, and at lock the
hashes of all predictions of the round become the entries root that stage 3 writes on-chain. With
this format, the hash and the signed text below, anyone can check that a bracket was scored exactly
as it was signed.

`prediction.schema.json` is the JSON Schema (draft 2020-12) of the document. The engine's
`checkPrediction` also checks the picks against the format template and the teams of the stage.

## Example

```json
{
  "format": 1,
  "tournament": "ti-2026",
  "contest": "ti-2026-bracket",
  "round": "bracket",
  "template": { "id": "ti", "version": 1 },
  "revision": 3,
  "picks": {
    "kind": "bracket",
    "slots": {
      "ubqf-1": { "winner": "team-spirit", "score": [2, 0] },
      "gf": { "winner": "team-spirit", "score": [3, 2] }
    }
  },
  "tiebreak": { "maps": 31 }
}
```

| Field        | Meaning                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------- |
| `format`     | Version of this document format; always 1 for now.                                       |
| `tournament` | The tournament id the platform publishes.                                                |
| `contest`    | Each round of a tournament is its own contest with its own lock and leaderboard.         |
| `round`      | `groups` or `bracket`; the template names the stage each round predicts.                 |
| `template`   | Format template id and version the round is scored with (see `../formats`).              |
| `revision`   | Save number: 1 for the first save, one more each time. The last save before lock counts. |
| `picks`      | One of the four kinds below, matching the predicted stage.                               |
| `tiebreak`   | Total maps the player expects in the round, or `null` if not answered.                   |

Picks by stage kind:

- `swiss`: `buckets` maps each team id to a bucket id of the template.
- `gsl`: `groups` maps each group label to the teams expected to finish `first` and `second`.
- `round-robin`: `groups` maps each group label to its `qualifiers` and its `winner`, one of them.
- `bracket`: `slots` maps each slot id to the expected `winner` and, for a Bo3 or a Bo5, an optional
  exact `score` with the winner's maps first.

## What the checks report

- **Issues** make a document invalid and the platform refuses to save it: a wrong shape, an unknown
  slot, bucket or group, a full bucket, a score that cannot end the series, a group winner who is
  not among the qualifiers, a document for another contest or template version.
- **Stale picks** no longer fit: a team that is not in the stage (for example one replaced before
  its first series), or a bracket winner who is not one of the two teams the player's own earlier
  picks put in that slot. They are kept and reported, and score nothing.
- **Missing picks** are still empty. An incomplete prediction is allowed: empty picks score nothing
  and an empty tie-break ranks last among equal points.

## What the wallet signs

The wallet signs this UTF-8 text (`signingMessage` in the engine). It binds the signature to one
site, one contest and one document hash, and expires, so a signature cannot be reused elsewhere or
later:

```text
bracketoracle.gg asks you to sign your Bracket Oracle prediction.

Signing is free and does not send a transaction.

Contest: ti-2026-bracket
Prediction: sha256:<64 hex characters>
Nonce: <8-64 letters or digits, issued for this save>
Expires: 2026-11-05T12:10:00.000Z
Version: 1
```

## Check a prediction yourself

```bash
node packages/verify/dist/cli.js prediction my-prediction.json
```

The file is either a prediction document, or `{ "prediction": …, "participants": … }` to also check
the picks against the teams of the stage. The command prints the hash the wallet signed.
