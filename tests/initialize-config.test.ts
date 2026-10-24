import { readFileSync } from 'node:fs';
import { AnchorProvider, Program, type Idl } from '@anchor-lang/core';
import { PublicKey } from '@solana/web3.js';
import { describe, expect, it } from 'vitest';

// Runs through `anchor test`, which starts a local validator with the freshly built program and
// points ANCHOR_PROVIDER_URL and ANCHOR_WALLET at it. The IDL comes from the same build.
const idl = JSON.parse(
  readFileSync(new URL('../target/idl/bracket_oracle.json', import.meta.url), 'utf8'),
) as Idl;

interface ConfigAccount {
  admin: PublicKey;
  bump: number;
}

const provider = AnchorProvider.env();
const program = new Program(idl, provider);
const admin = provider.wallet.publicKey;
const [configAddress, configBump] = PublicKey.findProgramAddressSync(
  [Buffer.from('config')],
  program.programId,
);

function initializeConfig() {
  const method = program.methods['initializeConfig'];
  if (!method) throw new Error('initializeConfig is missing from the IDL');
  return method().accounts({ admin }).rpc();
}

async function fetchConfig() {
  const info = await provider.connection.getAccountInfo(configAddress);
  if (!info) throw new Error('The config account does not exist');
  return { info, config: program.coder.accounts.decode<ConfigAccount>('config', info.data) };
}

describe('initialize_config on a local validator', () => {
  it('runs at the address declared in the program', () => {
    expect(program.programId.toBase58()).toBe('8RDMewh6hyF8dhHxsKDZZrhjnqkymtxLyHnHZaADciLv');
  });

  it('records the admin and the bump in the config PDA', async () => {
    await initializeConfig();

    const { info, config } = await fetchConfig();
    expect(config.admin.toBase58()).toBe(admin.toBase58());
    expect(config.bump).toBe(configBump);
    expect(info.owner.toBase58()).toBe(program.programId.toBase58());
    expect(info.data.length).toBe(8 + 32 + 1);
  });

  it('refuses to initialize the config twice', async () => {
    await expect(initializeConfig()).rejects.toThrow();

    const { config } = await fetchConfig();
    expect(config.admin.toBase58()).toBe(admin.toBase58());
  });
});
