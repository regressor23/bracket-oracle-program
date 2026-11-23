import { readFile } from 'node:fs/promises';
import {
  ENGINE_VERSION,
  bracketOutcome,
  checkPrediction,
  entriesRoot,
  entryLeafHash,
  entryLeafSchema,
  entryProof,
  formatPoints,
  getFormatTemplate,
  gslGroupOutcome,
  hashCanonical,
  parseEntriesRootMemo,
  maxBasePoints,
  maxExactScoreBonus,
  pickCount,
  picksMade,
  roundRobinGroupOutcome,
  roundStage,
  scoreContest,
  stageParticipantsSchema,
  swissOutcome,
  validateFormat,
  verifyProof,
  type BracketResults,
  type CanonicalValue,
  type FormatTemplate,
  type GslGroupResults,
  type OutcomeIssue,
  type RoundRobinGroupResults,
  type ScoringSettings,
  type StageResults,
  type StageParticipants,
  type SwissResults,
} from '@bracket-oracle/engine';

export const USAGE = `Usage: bracket-oracle-verify <command>

Commands:
  hash <file.json>     Print the canonical SHA-256 of a JSON file (bracket, results or payouts)
  format <file.json>   Check a format template and print its hash, picks and maximum points
  outcomes <file.json> Print a stage's outcomes from official results:
                       { "format": "<template id>" or a template, "stage": "<stage id>",
                         "results": bracket, Swiss or { "groups": [...] } results }
  prediction <file.json>
                       Check a prediction document and print the hash the wallet signed;
                       pass { "prediction": ..., "participants": ... } to check the teams too
  score <file.json>    Recompute the points and places of a contest:
                       { "format": "<template id>" or a template, "round": "groups" or "bracket",
                         "contest": optional id every prediction must name,
                         "results": the stage's results, "entries": [{ "id", "prediction" }],
                         "settings": optional underdog shares and team replacements }
  version              Print the engine version used for verification

  roots <file.json>    Recompute a contest's entries root from { "leaves": [...] }, compare it
                       with "root" and print the proof of "entry" when given; or check a
                       proof given as { "leaf": {...}, "proof": [...], "root": "..." }
  onchain <file.json>  Read an anchoring transaction from Solana and check its entries root:
                       { "signature": "...", "rpc": optional URL (default Solana devnet),
                         "signer": optional expected signer, "leaves": [...] to recompute
                         the root, or "root", "contest" and "count" to compare }

Coming with stage 4: the payouts root
and compare them with the values recorded on-chain.`;

export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

function describeFormat(template: FormatTemplate): string {
  const lines = [
    `${template.id} v${template.version} (${template.game}): valid`,
    `sha256 ${hashCanonical(template as unknown as CanonicalValue)}`,
  ];
  for (const round of ['groups', 'bracket'] as const) {
    const stage = roundStage(template, round);
    if (!stage) continue;
    const bonus = maxExactScoreBonus(stage);
    lines.push(
      `${round}: ${stage.id}, ${pickCount(stage)} picks, up to ${maxBasePoints(stage)} points` +
        (bonus > 0 ? ` (+${bonus} for exact scores)` : ''),
    );
  }
  return lines.join('\n');
}

interface OutcomesInput {
  format: string | FormatTemplate;
  stage: string;
  results: unknown;
}

/** Prints the outcome of one stage; issues go to stderr and make the exit code 1. */
function describeOutcomes(input: OutcomesInput): { lines: string[]; issues: OutcomeIssue[] } {
  const template =
    typeof input.format === 'string' ? getFormatTemplate(input.format) : input.format;
  if (!template) throw new Error(`unknown format template "${String(input.format)}"`);
  const stage = template.stages.find((s) => s.id === input.stage);
  if (!stage) throw new Error(`${template.id} has no stage "${input.stage}"`);
  const lines = [`${template.id} v${template.version}, ${stage.id} (${stage.kind})`];

  switch (stage.kind) {
    case 'bracket': {
      const outcome = bracketOutcome(stage, input.results as BracketResults);
      for (const slot of outcome.slots) {
        const score = slot.score ? ` ${slot.score[0]}-${slot.score[1]}` : '';
        const winner = slot.winner ? ` → ${slot.winner}${slot.forfeit ? ' (forfeit)' : ''}` : '';
        lines.push(`${slot.id}: ${slot.top ?? '?'} vs ${slot.bottom ?? '?'}${score}${winner}`);
      }
      lines.push(`champion: ${outcome.champion ?? 'not decided'}`);
      for (const p of outcome.placements) {
        lines.push(`${p.from === p.to ? p.from : `${p.from}-${p.to}`}: ${p.team}`);
      }
      return { lines, issues: outcome.issues };
    }
    case 'swiss': {
      const outcome = swissOutcome(stage, input.results as SwissResults);
      for (const team of outcome.teams) {
        const extra = team.eliminationRound ? `, elimination round ${team.eliminationRound}` : '';
        lines.push(`${team.team}: ${team.record}${extra} → ${team.bucket ?? 'not decided'}`);
      }
      return { lines, issues: outcome.issues };
    }
    case 'gsl': {
      const issues: OutcomeIssue[] = [];
      for (const group of (input.results as { groups: GslGroupResults[] }).groups) {
        const o = gslGroupOutcome(stage, group);
        issues.push(...o.issues);
        lines.push(
          `group ${o.group}: 1. ${o.first ?? '?'}, 2. ${o.second ?? '?'}, 3. ${o.third ?? '?'}, 4. ${o.fourth ?? '?'}`,
        );
      }
      return { lines, issues };
    }
    case 'round-robin': {
      const issues: OutcomeIssue[] = [];
      for (const group of (input.results as { groups: RoundRobinGroupResults[] }).groups) {
        const o = roundRobinGroupOutcome(stage, group);
        issues.push(...o.issues);
        lines.push(`group ${o.group}:`);
        for (const r of o.table) {
          lines.push(
            `  ${r.rank}. ${r.team} ${r.wins}-${r.draws}-${r.losses}, maps ${r.mapsWon}-${r.mapsLost}, ${r.points} pts`,
          );
        }
        lines.push(
          o.needsOrder
            ? '  a tie decides the group: the admin sets the order'
            : `  advance: ${o.qualifiers?.join(', ') ?? 'not decided'}`,
        );
      }
      return { lines, issues };
    }
    default:
      throw new Error(`${stage.id} is not predicted, so it has no outcomes`);
  }
}

/** Checks a prediction file: a bare document, or one with the stage's participants. */
function describePrediction(input: unknown): { lines: string[]; issues: string[] } {
  let document = input;
  let participants: StageParticipants | undefined;
  if (input && typeof input === 'object' && 'prediction' in input) {
    document = (input as { prediction: unknown }).prediction;
    if ('participants' in input) {
      const parsed = stageParticipantsSchema.safeParse(
        (input as { participants: unknown }).participants,
      );
      if (!parsed.success) {
        return {
          lines: [],
          issues: parsed.error.issues.map(
            (i) => `participants${i.path.length ? `.${i.path.join('.')}` : ''}: ${i.message}`,
          ),
        };
      }
      participants = parsed.data;
    }
  }
  const check = checkPrediction(document, participants ? { participants } : {});
  const issues = check.issues.map((i) => `${i.path || '<root>'}: ${i.message}`);
  const prediction = check.prediction;
  if (!prediction) return { lines: [], issues };

  const lines = [
    `contest ${prediction.contest}, ${prediction.template.id} v${prediction.template.version}, ` +
      `${prediction.round} round, revision ${prediction.revision}`,
    `sha256 ${check.hash}`,
  ];
  const template = getFormatTemplate(prediction.template.id);
  const stage = template && roundStage(template, prediction.round);
  const total = stage ? ` of ${pickCount(stage)}` : '';
  const tiebreak = prediction.tiebreak ? `${prediction.tiebreak.maps} maps` : 'not answered';
  lines.push(`picks: ${picksMade(prediction.picks)}${total}; tie-break: ${tiebreak}`);
  if (check.stale.length > 0) lines.push(`stale: ${check.stale.join(', ')}`);
  if (check.missing.length > 0) lines.push(`missing: ${check.missing.join(', ')}`);
  return { lines, issues };
}

interface ScoreInput {
  format: string | FormatTemplate;
  round: 'groups' | 'bracket';
  contest?: string;
  results: StageResults;
  entries: { id: string; prediction: unknown }[];
  settings?: ScoringSettings;
}

/** Points and places of every entry, best first; problems go to stderr. */
function describeScores(input: ScoreInput): { lines: string[]; issues: string[] } {
  const template =
    typeof input.format === 'string' ? getFormatTemplate(input.format) : input.format;
  if (!template) throw new Error(`unknown format template "${String(input.format)}"`);
  if (!Array.isArray(input.entries)) throw new Error('"entries" must be a list');
  const contest = scoreContest({
    template,
    round: input.round,
    ...(input.contest === undefined ? {} : { contest: input.contest }),
    results: input.results,
    entries: input.entries,
    ...(input.settings ? { settings: input.settings } : {}),
  });
  const state = contest.complete
    ? `complete, ${contest.mapsPlayed} maps played`
    : 'not complete, ties share places';
  const lines = [
    `${template.id} v${template.version}, ${contest.round} round (${contest.stage}): ${state}`,
  ];
  for (const e of contest.entries) {
    const place =
      e.place === null
        ? 'invalid'
        : e.place.from === e.place.to
          ? `${e.place.from}`
          : `${e.place.from}-${e.place.to}`;
    const tiebreak =
      e.tiebreak === null
        ? 'no tie-break'
        : `tie-break ${e.tiebreak}${e.distance === null ? '' : ` (${e.distance} off)`}`;
    lines.push(
      `${place}. ${e.id}: ${formatPoints(e.points)} points, ${e.correct} correct, ` +
        `${e.exactScores} exact, ${e.pending} pending, ${tiebreak}, sha256 ${e.hash ?? 'none'}`,
    );
  }
  const issues = [
    ...contest.issues.map((i) => `${i.at}: ${i.message}`),
    ...contest.entries.flatMap((e) => e.issues.map((i) => `entry ${e.id}: ${i}`)),
  ];
  return { lines, issues };
}

/** The entries root of published leaves, or the check of one entry's proof. */
function describeRoots(input: Record<string, unknown>): { lines: string[]; issues: string[] } {
  if ('leaf' in input) {
    const leaf = entryLeafSchema.safeParse(input.leaf);
    if (!leaf.success) {
      return {
        lines: [],
        issues: leaf.error.issues.map((i) => `leaf.${i.path.join('.')}: ${i.message}`),
      };
    }
    const proof = Array.isArray(input.proof) ? (input.proof as string[]) : [];
    // The leaf hash comes from the leaf itself, never from the file.
    const hash = entryLeafHash(leaf.data);
    const valid = verifyProof(hash, proof, String(input.root));
    return valid
      ? {
          lines: [`proof valid: entry ${leaf.data.entry} is in root ${String(input.root)}`],
          issues: [],
        }
      : {
          lines: [],
          issues: [
            `proof invalid: entry ${leaf.data.entry} does not lead to root ${String(input.root)}`,
          ],
        };
  }
  if (!Array.isArray(input.leaves)) throw new Error('expected "leaves", or "leaf" with "proof"');
  const root = entriesRoot(input.leaves);
  const lines = [`entries root ${root.root}`, `${root.leaves.length} entries`];
  const issues: string[] = [];
  if (typeof input.root === 'string') {
    if (input.root === root.root) lines.push('matches the published root');
    else issues.push(`does not match the published root ${input.root}`);
  }
  if (typeof input.entry === 'string') {
    const proof = entryProof(root, input.entry);
    lines.push(`proof of ${input.entry}:`, ...proof.proof.map((h) => `  ${h}`));
  }
  return { lines, issues };
}

export const DEVNET_RPC = 'https://api.devnet.solana.com';
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

/** Posts one JSON-RPC request and returns its `result`. */
export type RpcCall = (url: string, method: string, params: unknown[]) => Promise<unknown>;

const rpcCall: RpcCall = async (url, method, params) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`RPC answered HTTP ${response.status}`);
  const body = (await response.json()) as { result?: unknown; error?: { message?: string } };
  if (body.error) throw new Error(`RPC error: ${body.error.message ?? 'unknown'}`);
  return body.result;
};

interface ParsedTransaction {
  slot: number;
  blockTime: number | null;
  meta: { err: unknown } | null;
  transaction: {
    message: {
      accountKeys: { pubkey: string; signer: boolean }[];
      instructions: { programId: string; parsed?: unknown }[];
    };
  };
}

/**
 * Reads an anchoring transaction (see `entriesRootMemo` in the engine) and checks the root in its
 * memo against the leaves, or against the root, contest and count given in the file.
 */
async function describeOnchain(
  input: Record<string, unknown>,
  call: RpcCall,
): Promise<{ lines: string[]; issues: string[] }> {
  if (typeof input.signature !== 'string') throw new Error('expected "signature"');
  const rpc = typeof input.rpc === 'string' ? input.rpc : DEVNET_RPC;
  const tx = (await call(rpc, 'getTransaction', [
    input.signature,
    { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 },
  ])) as ParsedTransaction | null;
  if (!tx) return { lines: [], issues: [`transaction ${input.signature} was not found`] };

  const when = tx.blockTime ? ` at ${new Date(tx.blockTime * 1000).toISOString()}` : '';
  const lines = [`transaction ${input.signature}: slot ${tx.slot}${when}`];
  const issues: string[] = [];
  if (!tx.meta || tx.meta.err !== null) {
    issues.push(`the transaction failed: ${JSON.stringify(tx.meta?.err ?? 'no status')}`);
  }
  const signers = tx.transaction.message.accountKeys.filter((k) => k.signer).map((k) => k.pubkey);
  lines.push(`signed by ${signers.join(', ')}`);
  if (typeof input.signer === 'string' && !signers.includes(input.signer)) {
    issues.push(`not signed by ${input.signer}`);
  }

  const memos = tx.transaction.message.instructions
    .filter((ix) => ix.programId === MEMO_PROGRAM_ID && typeof ix.parsed === 'string')
    .map((ix) => parseEntriesRootMemo(ix.parsed as string))
    .filter((m) => m !== null);
  if (memos.length !== 1) {
    issues.push(`expected one entries-root memo, found ${memos.length}`);
    return { lines, issues };
  }
  const anchored = memos[0]!;
  lines.push(
    `anchored: contest ${anchored.contest}, root ${anchored.root}, ${anchored.count} entries`,
  );

  let expected: { contest?: unknown; root?: unknown; count?: unknown } = input;
  if (Array.isArray(input.leaves)) {
    const computed = entriesRoot(input.leaves);
    expected = {
      contest: computed.leaves[0]?.leaf.contest ?? input.contest,
      root: computed.root,
      count: computed.leaves.length,
    };
    lines.push(`leaves: root ${computed.root}, ${computed.leaves.length} entries`);
  }
  const mismatches: string[] = [];
  if (expected.root !== undefined && expected.root !== anchored.root) mismatches.push('root');
  if (expected.contest !== undefined && expected.contest !== anchored.contest) {
    mismatches.push('contest');
  }
  if (expected.count !== undefined && expected.count !== anchored.count) mismatches.push('count');
  if (expected.root === undefined) {
    lines.push('nothing to compare: pass "leaves" or "root"');
  } else if (mismatches.length === 0) {
    lines.push('matches the anchored root');
  } else {
    issues.push(`does not match the anchored ${mismatches.join(', ')}`);
  }
  return { lines, issues };
}

async function readJson(file: string, read: (path: string) => Promise<string>): Promise<unknown> {
  return JSON.parse(await read(file)) as unknown;
}

export async function run(
  args: string[],
  read: (path: string) => Promise<string> = (path) => readFile(path, 'utf8'),
  call: RpcCall = rpcCall,
): Promise<CliResult> {
  const [command, file] = args;
  switch (command) {
    case 'version':
      return { code: 0, stdout: ENGINE_VERSION, stderr: '' };
    case 'hash': {
      if (!file) return { code: 2, stdout: '', stderr: USAGE };
      try {
        const value = JSON.parse(await read(file)) as CanonicalValue;
        return { code: 0, stdout: hashCanonical(value), stderr: '' };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { code: 1, stdout: '', stderr: `Cannot hash ${file}: ${message}` };
      }
    }
    case 'format': {
      if (!file) return { code: 2, stdout: '', stderr: USAGE };
      try {
        const result = validateFormat(await readJson(file, read));
        if (result.ok) return { code: 0, stdout: describeFormat(result.template), stderr: '' };
        const issues = result.issues.map((issue) => `  ${issue.path}: ${issue.message}`);
        return {
          code: 1,
          stdout: '',
          stderr: [`${file} is not a valid format:`, ...issues].join('\n'),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { code: 1, stdout: '', stderr: `Cannot read ${file}: ${message}` };
      }
    }
    case 'outcomes': {
      if (!file) return { code: 2, stdout: '', stderr: USAGE };
      try {
        const { lines, issues } = describeOutcomes((await readJson(file, read)) as OutcomesInput);
        const stderr = issues.map((i) => `${i.at}: ${i.message}`).join('\n');
        return { code: issues.length > 0 ? 1 : 0, stdout: lines.join('\n'), stderr };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { code: 1, stdout: '', stderr: `Cannot compute outcomes from ${file}: ${message}` };
      }
    }
    case 'prediction': {
      if (!file) return { code: 2, stdout: '', stderr: USAGE };
      try {
        const { lines, issues } = describePrediction(await readJson(file, read));
        return {
          code: issues.length > 0 ? 1 : 0,
          stdout: lines.join('\n'),
          stderr:
            issues.length > 0
              ? [`${file} is not a valid prediction:`, ...issues.map((i) => `  ${i}`)].join('\n')
              : '',
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { code: 1, stdout: '', stderr: `Cannot read ${file}: ${message}` };
      }
    }
    case 'score': {
      if (!file) return { code: 2, stdout: '', stderr: USAGE };
      try {
        const { lines, issues } = describeScores((await readJson(file, read)) as ScoreInput);
        return {
          code: issues.length > 0 ? 1 : 0,
          stdout: lines.join('\n'),
          stderr: issues.join('\n'),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { code: 1, stdout: '', stderr: `Cannot score ${file}: ${message}` };
      }
    }
    case 'roots': {
      if (!file) return { code: 2, stdout: '', stderr: USAGE };
      try {
        const { lines, issues } = describeRoots(
          (await readJson(file, read)) as Record<string, unknown>,
        );
        return {
          code: issues.length > 0 ? 1 : 0,
          stdout: lines.join('\n'),
          stderr: issues.join('\n'),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { code: 1, stdout: '', stderr: `Cannot compute roots from ${file}: ${message}` };
      }
    }
    case 'onchain': {
      if (!file) return { code: 2, stdout: '', stderr: USAGE };
      try {
        const { lines, issues } = await describeOnchain(
          (await readJson(file, read)) as Record<string, unknown>,
          call,
        );
        return {
          code: issues.length > 0 ? 1 : 0,
          stdout: lines.join('\n'),
          stderr: issues.join('\n'),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { code: 1, stdout: '', stderr: `Cannot check ${file} on-chain: ${message}` };
      }
    }
    default:
      return { code: command ? 2 : 0, stdout: command ? '' : USAGE, stderr: command ? USAGE : '' };
  }
}
