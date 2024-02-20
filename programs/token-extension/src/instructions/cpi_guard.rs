use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke, system_instruction},
};
use anchor_spl::{
    token_2022::{initialize_account3, InitializeAccount3},
    token_interface::{Mint, Token2022},
};

use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct CpiGuardAccount<'info> {
    #[account(
        mint::token_program = Token2022::id()
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        owner= System::id() @ ErrorCode::InvalidAccountOwner,
        constraint = token_acc.data_is_empty() @ ErrorCode::AlreadyInUse
    )]
    pub token_acc: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub wallet: Signer<'info>,
    pub token_2022_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> CpiGuardAccount<'info> {
    fn initialize_account3_cpi(&self) -> CpiContext<'_, '_, '_, 'info, InitializeAccount3<'info>> {
        CpiContext::new(
            self.token_2022_program.to_account_info(),
            InitializeAccount3 {
                mint: self.mint.to_account_info(),
                account: self.token_acc.to_account_info(),
                authority: self.wallet.to_account_info(),
            },
        )
    }
}

pub(crate) fn handler_to_cpi_guard(ctx: Context<CpiGuardAccount>, account_len: u64) -> Result<()> {
    let all = ctx.accounts;

    invoke(
        &system_instruction::create_account(
            &all.payer.key(),
            &all.token_acc.key(),
            Rent::get()?.minimum_balance(account_len as usize),
            account_len,
            &Token2022::id(),
        ),
        &[
            all.wallet.to_account_info(),
            all.token_acc.to_account_info(),
            all.system_program.to_account_info(),
        ],
    )?;

    initialize_account3(all.initialize_account3_cpi())
}
