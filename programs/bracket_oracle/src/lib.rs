//! Bracket Oracle on-chain program.
//!
//! Stage 0 skeleton: a single `initialize_config` instruction that records the
//! platform admin in a config PDA. Pools, entries, settlement by merkle root and
//! claims arrive in stage 3 (see the approved ADRs in the private repository).

use anchor_lang::prelude::*;

declare_id!("8RDMewh6hyF8dhHxsKDZZrhjnqkymtxLyHnHZaADciLv");

/// Seed of the singleton config account.
pub const CONFIG_SEED: &[u8] = b"config";

#[program]
pub mod bracket_oracle {
    use super::*;

    /// Creates the config PDA and records who administers the program.
    pub fn initialize_config(ctx: Context<InitializeConfig>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.bump = ctx.bumps.config;
        msg!("Bracket Oracle config initialized");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = Config::SPACE,
        seeds = [CONFIG_SEED],
        bump,
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Config {
    /// Platform admin. Moves to a Squads multisig before mainnet (stage 3).
    pub admin: Pubkey,
    pub bump: u8,
}

impl Config {
    /// Discriminator + admin + bump.
    pub const SPACE: usize = 8 + 32 + 1;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_space_matches_layout() {
        let config = Config {
            admin: Pubkey::new_unique(),
            bump: 255,
        };
        let mut data = Vec::new();
        config.try_serialize(&mut data).unwrap();
        assert_eq!(data.len(), Config::SPACE);
    }

    #[test]
    fn config_pda_is_deterministic() {
        let (first, _) = Pubkey::find_program_address(&[CONFIG_SEED], &crate::ID);
        let (second, _) = Pubkey::find_program_address(&[CONFIG_SEED], &crate::ID);
        assert_eq!(first, second);
    }
}
