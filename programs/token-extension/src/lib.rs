pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;

declare_id!("2A4udxjXYzZnJgX65cbVpr3421bpWrrjUBNey1iWrEiy");

#[program]
pub mod token_extension {

    use super::*;

    pub fn mint_close_authority(ctx: Context<MintCloseAuthority>, data_len: u64) -> Result<()> {
        mint_close_authority::handler(ctx, data_len)
    }

    pub fn close_mint_account(ctx: Context<CloseMintAccount>) -> Result<()> {
        close_mint_account::handler(ctx)
    }
}
