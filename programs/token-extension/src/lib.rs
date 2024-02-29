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

    // Initialize Mint Close Authority, then it is possible to close token mint.
    pub fn mint_close_authority(ctx: Context<MintCloseAuthority>, data_len: u64) -> Result<()> {
        mint_close_authority::handler(ctx, data_len)
    }

    // Once close authority set, use this instruction to close token mint.
    pub fn close_mint_account(ctx: Context<CloseMintAccount>) -> Result<()> {
        close_mint_account::handler(ctx)
    }

    // Initialize transfer fee config and set respective authority to withdraw tokens.
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

    // Mint some token to account.
    pub fn mint_to(ctx: Context<MintToAccount>, amount: u64) -> Result<()> {
        transfer_fee::handler_for_mint_to(ctx, amount)
    }

    // Transfer some token from source to destination.
    pub fn transfer_to(ctx: Context<TransferToAccount>, amount: u64, fee: u64) -> Result<()> {
        transfer_fee::handler_for_transfer_to_account(ctx, amount, fee)
    }

    // Withdraw token withheld by the account owner.
    pub fn withdraw_withheld_account<'a>(
        ctx: Context<'_, '_, '_, 'a, WithdrawFromWithheldAccount<'a>>,
    ) -> Result<()> {
        transfer_fee::handler_for_withdraw_withheld_account(ctx)
    }

    // Harvest token from account to clear out their account of withheld tokens.
    pub fn harvest_withheld_token<'a>(
        ctx: Context<'_, '_, '_, 'a, HarvestWithheldToken<'a>>,
    ) -> Result<()> {
        transfer_fee::handler_for_harvest_withheld_token(ctx)
    }

    // Withdraw withheld tokens from mint
    pub fn withdraw_withheld_mint(ctx: Context<WithdrawFromWithheldMint>) -> Result<()> {
        transfer_fee::handler_for_withdraw_withheld_mint(ctx)
    }

    // Create a mint with default frozen account.
    pub fn default_account_state(ctx: Context<DefaultAccountState>, data_len: u64) -> Result<()> {
        default_account_state::handler_for_default_account_state(ctx, data_len)
    }

    // Update the mint with Initialized state
    pub fn update_default_account_state(
        ctx: Context<UpdateDefaultAccountState>,
        account_state: u8,
    ) -> Result<()> {
        default_account_state::handler_for_update_default_account_state(ctx, account_state)
    }

    // Create a account whose ownership can't transferred
    pub fn immutable_owner(
        ctx: Context<ImmutableOwner>,
        mint_len: u64,
        account_len: u64,
    ) -> Result<()> {
        immutable_owner::handler(ctx, mint_len, account_len)
    }

    // Create a token which can't be transferred. Can be use of KYC purpose.
    // Note: In order to processed this instruction successfully it needs to set immutable owner as well.
    pub fn non_transferable_token(
        ctx: Context<NonTransferableToken>,
        mint_len: u64,
        account_len: u64,
    ) -> Result<()> {
        non_transferable_tokens::handler(ctx, mint_len, account_len)
    }

    // Enable a account with required memo on transfer.
    pub fn enable_memo(ctx: Context<EnableMemo>, account_len: u64) -> Result<()> {
        memo_transfer::handler_to_enable_memo(ctx, account_len)
    }

    // Demonstrate memo usage while transfering tokens.
    pub fn memo_transfer(ctx: Context<MemoTransfer>, amount: u64, decimals: u8) -> Result<()> {
        memo_transfer::handler_to_memo_transfer(ctx, amount, decimals)
    }

    // Instruction to add some new extension to already extensioned account.
    pub fn realloc(ctx: Context<Realloc>) -> Result<()> {
        realloc::handler_to_realloc(ctx)
    }

    // Initialize interest bearing tokens to accumulate interest based on the timestamp in the network.
    pub fn interest_bearing_token(
        ctx: Context<InterestBearingToken>,
        mint_len: u64,
        rate: i16,
    ) -> Result<()> {
        interest_bearing_token::handler_to_interest_bearing_token(ctx, mint_len, rate)
    }

    // Instruction used to fetch token amount with the interest at any time.
    pub fn amount_to_ui_amount(ctx: Context<AmountToUI>, amount: u64) -> Result<String> {
        interest_bearing_token::handle_amount_to_ui(ctx, amount)
    }

    // Initialize permanent account delegate for a mint.
    pub fn permanent_delegate(ctx: Context<PermanentDelegate>, mint_len: u64) -> Result<()> {
        permanent_delegate::handler_to_permanent_delegate(ctx, mint_len)
    }

    // Create ATA account
    pub fn create_ata(ctx: Context<CreateATA>) -> Result<()> {
        permanent_delegate::handler_to_create_ata(ctx)
    }

    // Burn some token from permanent delegated account with owner permission.
    pub fn burn_cpi(ctx: Context<BurnCpi>, amount: u64) -> Result<()> {
        permanent_delegate::handler_to_burn(ctx, amount)
    }

    // Initialize token account with CPI Guard or Immutable Owner or Required Memo on Transfer
    pub fn initialize_token_account_with(
        ctx: Context<IntializeTokenAccount>,
        account_len: u64,
    ) -> Result<()> {
        cpi_guard::handler_to_initialize_token_account(ctx, account_len)
    }

    // Demonstrate CPI guard and without CPI guard account using transfer token ix and use of opaque program.
    pub fn transfer_token(ctx: Context<TransferToken>, amount: u64, decimals: u8) -> Result<()> {
        cpi_guard::handler_to_transfer_token(ctx, amount, decimals)
    }

    // Initialize transfer hook for mint.
    pub fn initialize_hook_mint(
        ctx: Context<InitializeHookMint>,
        mint_len: u64,
        transfer_hook_program_id: Option<Pubkey>,
    ) -> Result<()> {
        transfer_hook::handler_to_initialize_hook_mint(ctx, mint_len, transfer_hook_program_id)
    }

    // After transfer the transfer hook ix get called from transfer_program.
    pub fn transfer_hook_token<'a>(
        ctx: Context<'_, '_, '_, 'a, TransferHookToken<'a>>,
        amount: u64,
        decimals: u8,
    ) -> Result<()> {
        transfer_hook::handler_to_transfer_token(ctx, amount, decimals)
    }

    // Initialize a mint with metadata (name, symbol, uri).
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

    // Update a mint metadata Field(name, symbol, uri) and value.
    pub fn update_metadata_field(
        ctx: Context<UpdateMetadataField>,
        field: Field,
        value: String,
    ) -> Result<()> {
        metadata_pointer::handler_to_update_metadata_field(ctx, field, value)
    }

    // 🚧 Confidential extension work is in progress 🚧
    // Initialize confidential mint
    pub fn initialize_confidential_mint(
        ctx: Context<InitializeConfidentialMint>,
        mint_len: u64,
        decimals: u8,
    ) -> Result<()> {
        confidential_transfer::handler_to_initialize_confidential_mint(ctx, mint_len, decimals)
    }

    // 🚧 Confidential extension work is in progress 🚧
    // Initialize confidential account partially built
    pub fn initialize_confidential_account(
        ctx: Context<InitializeConfidentialAccount>,
        account_len: u64,
    ) -> Result<()> {
        confidential_transfer::handler_to_initialize_confidential_account(ctx, account_len)
    }

    // Initialize only group pointer
    // Fix Required: due to invalid instruction error for spl_token_group_interface::instruction::initialize_group the code commented out
    pub fn initialize_group_pointer(
        ctx: Context<InitializeGroupPointer>,
        mint_len: u64,
        decimals: u8,
        max_size: u32,
    ) -> Result<()> {
        group_pointer::handler_to_initialize_group_pointer(ctx, mint_len, decimals, max_size)
    }

    // Initialize only member pointer using above group address
    // Fix Required: due to invalid instruction error for spl_token_group_interface::instruction::initialize_member the code commented out
    pub fn initialize_member_pointer(
        ctx: Context<InitializeMemberPointer>,
        mint_len: u64,
        decimals: u8,
    ) -> Result<()> {
        member_pointer::handler_to_initialize_member_pointer(ctx, mint_len, decimals)
    }
}
