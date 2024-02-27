use {
    crate::error::ErrorCode,
    anchor_lang::{
        prelude::*,
        solana_program::{program::invoke, system_instruction},
    },
    anchor_spl::{
        token_2022::{self, initialize_mint2, InitializeMint2, Token2022},
        token_interface::{
            spl_token_2022::extension::transfer_hook::instruction::initialize,
            spl_token_2022::onchain::invoke_transfer_checked, Mint, TokenAccount,
        },
    },
};

#[derive(Accounts)]
pub struct InitializeHookMint<'info> {
    #[account(
        mut,
        owner = System::id() @ ErrorCode::InvalidAccountOwner,
        constraint = mint.data_is_empty() @ ErrorCode::AlreadyInUse
    )]
    pub mint: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub all_mint_role: Signer<'info>,
    pub token_2022_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> InitializeHookMint<'info> {
    fn initialize_mint_2_cpi(&self) -> CpiContext<'_, '_, '_, 'info, InitializeMint2<'info>> {
        CpiContext::new(
            self.token_2022_program.to_account_info(),
            InitializeMint2 {
                mint: self.mint.to_account_info(),
            },
        )
    }
}

pub(crate) fn handler_to_initialize_hook_mint(
    ctx: Context<InitializeHookMint>,
    mint_len: u64,
    transfer_hook_program_id: Option<Pubkey>,
) -> Result<()> {
    let all = ctx.accounts;

    invoke(
        &system_instruction::create_account(
            all.payer.key,
            all.mint.key,
            Rent::get()?.minimum_balance(mint_len as usize),
            mint_len,
            &token_2022::ID,
        ),
        &[all.payer.to_account_info(), all.mint.to_account_info()],
    )?;

    let ix = initialize(
        all.token_2022_program.key,
        all.mint.key,
        Some(all.all_mint_role.key()),
        transfer_hook_program_id,
    )?;

    invoke(
        &ix,
        &[
            all.token_2022_program.to_account_info(),
            all.mint.to_account_info(),
            all.all_mint_role.to_account_info(),
        ],
    )?;

    initialize_mint2(all.initialize_mint_2_cpi(), 2, all.all_mint_role.key, None)?;
    Ok(())
}

#[derive(Accounts)]
pub struct TransferHookToken<'info> {
    #[account(
        mint::token_program = Token2022::id()
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = authority,
        token::token_program = Token2022::id()
    )]
    pub from_acc: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = mint,
        token::token_program = Token2022::id()
    )]
    pub to_acc: InterfaceAccount<'info, TokenAccount>,
    pub token_2022_program: Program<'info, Token2022>,
    pub authority: Signer<'info>,
}

pub(crate) fn handler_to_transfer_token<'a>(
    ctx: Context<'_, '_, '_, 'a, TransferHookToken<'a>>,
    amount: u64,
    decimals: u8,
) -> Result<()> {
    let all = ctx.accounts;

    invoke_transfer_checked(
        all.token_2022_program.key,
        all.from_acc.to_account_info(),
        all.mint.to_account_info(),
        all.to_acc.to_account_info(),
        all.authority.to_account_info(),
        ctx.remaining_accounts,
        amount,
        decimals,
        &[],
    )?;
    Ok(())
}
