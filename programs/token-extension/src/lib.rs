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

    pub fn immutable_owner(
        ctx: Context<ImmutableOwner>,
        mint_len: u64,
        account_len: u64,
    ) -> Result<()> {
        immutable_owner::handler(ctx, mint_len, account_len)
    }

    pub fn non_transferable_token(
        ctx: Context<NonTransferableToken>,
        mint_len: u64,
        account_len: u64,
    ) -> Result<()> {
        non_transferable_tokens::handler(ctx, mint_len, account_len)
    }

    pub fn enable_memo(ctx: Context<EnableMemo>, account_len: u64) -> Result<()> {
        memo_transfer::handler_to_enable_memo(ctx, account_len)
    }

    pub fn memo_transfer(ctx: Context<MemoTransfer>, amount: u64, decimals: u8) -> Result<()> {
        memo_transfer::handler_to_memo_transfer(ctx, amount, decimals)
    }

    pub fn realloc(ctx: Context<Realloc>) -> Result<()> {
        realloc::handler_to_realloc(ctx)
    }

    pub fn interest_bearing_token(
        ctx: Context<InterestBearingToken>,
        mint_len: u64,
        rate: i16,
    ) -> Result<()> {
        interest_bearing_token::handler_to_interest_bearing_token(ctx, mint_len, rate)
    }

    pub fn amount_to_ui_amount(ctx: Context<AmountToUI>, amount: u64) -> Result<String> {
        interest_bearing_token::handle_amount_to_ui(ctx, amount)
    }

    pub fn permanent_delegate(ctx: Context<PermanentDelegate>, mint_len: u64) -> Result<()> {
        permanent_delegate::handler_to_permanent_delegate(ctx, mint_len)
    }

    pub fn create_ata(ctx: Context<CreateATA>) -> Result<()> {
        permanent_delegate::handler_to_create_ata(ctx)
    }

    pub fn burn_cpi(ctx: Context<BurnCpi>, amount: u64) -> Result<()> {
        permanent_delegate::handler_to_burn(ctx, amount)
    }

    pub fn initialize_token_account_with(
        ctx: Context<CpiGuardAccount>,
        account_len: u64,
    ) -> Result<()> {
        cpi_guard::handler_to_initialize_token_account(ctx, account_len)
    }

    pub fn transfer_token(ctx: Context<TransferToken>, amount: u64, decimals: u8) -> Result<()> {
        cpi_guard::handler_to_transfer_token(ctx, amount, decimals)
    }

    pub fn initialize_hook_mint(
        ctx: Context<InitializeHookMint>,
        mint_len: u64,
        transfer_hook_program_id: Option<Pubkey>,
    ) -> Result<()> {
        transfer_hook::handler_to_initialize_hook_mint(ctx, mint_len, transfer_hook_program_id)
    }

    pub fn transfer_hook_token<'a>(
        ctx: Context<'_, '_, '_, 'a, TransferHookToken<'a>>,
        amount: u64,
        decimals: u8,
    ) -> Result<()> {
        transfer_hook::handler_to_transfer_token(ctx, amount, decimals)
    }

    pub fn initialize_metadata_pointer(
        ctx: Context<MetadataPointer>,
        mint_len: u64,
        decimals: u8,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        metadata_pointer::handler_to_initialize_metadata_pointer(
            ctx, mint_len, decimals, name, symbol, uri,
        )
    }

    pub fn update_metadata_field(
        ctx: Context<UpdateMetadataField>,
        field: Field,
        value: String,
    ) -> Result<()> {
        metadata_pointer::handler_to_update_metadata_field(ctx, field, value)
    }

    pub fn initialize_confidential_mint(
        ctx: Context<InitializeConfidentialMint>,
        mint_len: u64,
        decimals: u8,
    ) -> Result<()> {
        confidential_transfer::handler_to_initialize_confidential_mint(ctx, mint_len, decimals)
    }

    pub fn initialize_confidential_account(
        ctx: Context<InitializeConfidentialAccount>,
        account_len: u64,
    ) -> Result<()> {
        confidential_transfer::handler_to_initialize_confidential_account(ctx, account_len)
    }

    pub fn initialize_group_pointer(
        ctx: Context<InitializeGroupPointer>,
        mint_len: u64,
        account_len: u64,
        decimals: u8,
        max_size: u32,
    ) -> Result<()> {
        group_pointer::handler_to_initialize_group_pointer(
            ctx,
            mint_len,
            account_len,
            decimals,
            max_size,
        )
    }
}
