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

    pub fn transfer_fee_config(
        ctx: Context<TransferFeeConfig>,
        data_len: u64,
        transfer_fee_config_authority: Option<Pubkey>,
        withdraw_withheld_authority: Option<Pubkey>,
        transfer_fee_basis_points: u16,
        maximum_fee: u64,
    ) -> Result<()> {
        transfer_fee::handler(
            ctx,
            data_len,
            transfer_fee_config_authority,
            withdraw_withheld_authority,
            transfer_fee_basis_points,
            maximum_fee,
        )
    }

    pub fn mint_to(ctx: Context<MintToAccount>, amount: u64) -> Result<()> {
        transfer_fee::handler_for_mint_to(ctx, amount)
    }

    pub fn transfer_to(ctx: Context<TransferToAccount>, amount: u64, fee: u64) -> Result<()> {
        transfer_fee::handler_for_transfer_to_account(ctx, amount, fee)
    }

    pub fn withdraw_withheld_account<'a>(
        ctx: Context<'_, '_, '_, 'a, WithdrawFromWithheldAccount<'a>>,
    ) -> Result<()> {
        transfer_fee::handler_for_withdraw_withheld_account(ctx)
    }

    pub fn harvest_withheld_token<'a>(
        ctx: Context<'_, '_, '_, 'a, HarvestWithheldToken<'a>>,
    ) -> Result<()> {
        transfer_fee::handler_for_harvest_withheld_token(ctx)
    }

    pub fn withdraw_withheld_mint(ctx: Context<WithdrawFromWithheldMint>) -> Result<()> {
        transfer_fee::handler_for_withdraw_withheld_mint(ctx)
    }

    pub fn default_account_state(ctx: Context<DefaultAccountState>, data_len: u64) -> Result<()> {
        default_account_state::handler_for_default_account_state(ctx, data_len)
    }

    pub fn update_default_account_state(
        ctx: Context<UpdateDefaultAccountState>,
        account_state: u8,
    ) -> Result<()> {
        default_account_state::handler_for_update_default_account_state(ctx, account_state)
    }
}
