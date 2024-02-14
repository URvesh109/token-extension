use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke, system_instruction},
};
use anchor_spl::{
    memo::{build_memo, BuildMemo, Memo},
    token_2022::{initialize_account3, transfer_checked, InitializeAccount3, TransferChecked},
    token_interface::{
        spl_token_2022::extension::memo_transfer::instruction::enable_required_transfer_memos,
        Mint, Token2022, TokenAccount, TokenInterface,
    },
};

use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct EnableMemo<'info> {
    #[account(
        mint::token_program = Token2022::id()
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        owner= System::id() @ ErrorCode::InvalidAccountOwner,
        constraint = receiver_acc.data_is_empty() @ ErrorCode::AlreadyInUse
    )]
    pub receiver_acc: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub receiver: Signer<'info>,
    pub token_2022_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> EnableMemo<'info> {
    fn initialize_account3_cpi(&self) -> CpiContext<'_, '_, '_, 'info, InitializeAccount3<'info>> {
        CpiContext::new(
            self.token_2022_program.to_account_info(),
            InitializeAccount3 {
                mint: self.mint.to_account_info(),
                account: self.receiver_acc.to_account_info(),
                authority: self.receiver.to_account_info(),
            },
        )
    }
}

pub(crate) fn handler_to_enable_memo(ctx: Context<EnableMemo>, account_len: u64) -> Result<()> {
    let all = ctx.accounts;

    invoke(
        &system_instruction::create_account(
            &all.payer.key(),
            &all.receiver_acc.key(),
            Rent::get()?.minimum_balance(account_len as usize),
            account_len,
            &Token2022::id(),
        ),
        &[
            all.payer.to_account_info(),
            all.receiver_acc.to_account_info(),
            all.system_program.to_account_info(),
        ],
    )?;

    initialize_account3(all.initialize_account3_cpi())?;

    let ix = enable_required_transfer_memos(
        all.token_2022_program.key,
        all.receiver_acc.key,
        all.receiver.key,
        &[],
    )?;

    invoke(
        &ix,
        &[
            all.token_2022_program.to_account_info(),
            all.receiver_acc.to_account_info(),
            all.receiver.to_account_info(),
        ],
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct MemoTransfer<'info> {
    #[account(
        mint::token_program = Token2022::id()
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = authority,
        associated_token::token_program = Token2022::id()
    )]
    pub from_acc: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub to_acc: InterfaceAccount<'info, TokenAccount>,
    pub token_2022_program: Interface<'info, TokenInterface>,
    pub authority: Signer<'info>,
    pub memo_program: Program<'info, Memo>,
}

impl<'info> MemoTransfer<'info> {
    fn transfer_checked_cpi(&self) -> CpiContext<'_, '_, '_, 'info, TransferChecked<'info>> {
        CpiContext::new(
            self.token_2022_program.to_account_info(),
            TransferChecked {
                mint: self.mint.to_account_info(),
                from: self.from_acc.to_account_info(),
                to: self.to_acc.to_account_info(),
                authority: self.authority.to_account_info(),
            },
        )
    }

    fn build_memo_cpi(&self) -> CpiContext<'_, '_, '_, 'info, BuildMemo> {
        CpiContext::new(self.token_2022_program.to_account_info(), BuildMemo {})
    }
}

pub(crate) fn handler_to_memo_transfer(
    ctx: Context<MemoTransfer>,
    amount: u64,
    decimals: u8,
) -> Result<()> {
    let all = ctx.accounts;

    build_memo(all.build_memo_cpi(), "Testing memo string".as_bytes())?;

    transfer_checked(all.transfer_checked_cpi(), amount, decimals)?;

    Ok(())
}
