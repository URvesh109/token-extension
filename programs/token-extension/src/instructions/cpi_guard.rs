use anchor_lang::{
    prelude::*,
    solana_program::{native_token::sol_to_lamports, program::invoke, system_instruction},
};
use anchor_spl::{
    token_2022::{initialize_account3, transfer_checked, InitializeAccount3, TransferChecked},
    token_interface::{Mint, Token2022, TokenAccount},
};
use opaque::{
    cpi::{accounts::TransferSol, transfer_sol},
    program::Opaque,
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

pub(crate) fn handler_to_initialize_token_account(
    ctx: Context<CpiGuardAccount>,
    account_len: u64,
) -> Result<()> {
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

#[derive(Accounts)]
pub struct TransferToken<'info> {
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
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut)]
    pub bad_wallet: SystemAccount<'info>,
    pub opaque: Program<'info, Opaque>,
    pub system_program: Program<'info, System>,
}

impl<'info> TransferToken<'info> {
    fn transfer_checked_cpi(&self) -> CpiContext<'_, '_, '_, 'info, TransferChecked<'info>> {
        CpiContext::new(
            self.token_2022_program.to_account_info(),
            TransferChecked {
                from: self.from_acc.to_account_info(),
                mint: self.mint.to_account_info(),
                to: self.to_acc.to_account_info(),
                authority: self.authority.to_account_info(),
            },
        )
    }

    fn transfer_sol_cpi(&self) -> CpiContext<'_, '_, '_, 'info, TransferSol<'info>> {
        CpiContext::new(
            self.opaque.to_account_info(),
            TransferSol {
                from_wallet: self.authority.to_account_info(),
                to_wallet: self.bad_wallet.to_account_info(),
                system_program: self.system_program.to_account_info(),
            },
        )
    }
}

pub(crate) fn handler_to_transfer_token(
    ctx: Context<TransferToken>,
    amount: u64,
    decimals: u8,
) -> Result<()> {
    let all = ctx.accounts;

    transfer_sol(all.transfer_sol_cpi(), sol_to_lamports(1.1))?;
    transfer_checked(all.transfer_checked_cpi(), amount, decimals)?;
    Ok(())
}
