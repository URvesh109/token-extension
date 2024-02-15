use anchor_lang::{prelude::*, solana_program::program::invoke};
use anchor_spl::token_interface::{
    spl_token_2022::extension::{
        memo_transfer::instruction::enable_required_transfer_memos, ExtensionType,
    },
    spl_token_2022::instruction::reallocate,
    Token2022, TokenAccount,
};

#[derive(Accounts)]
pub struct Realloc<'info> {
    #[account(mut)]
    pub token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub all_mint_role: Signer<'info>,
    pub token_2022_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn handler_to_realloc(ctx: Context<Realloc>) -> Result<()> {
    let all = ctx.accounts;

    let ix = reallocate(
        all.token_2022_program.key,
        &all.token_account.key(),
        all.payer.key,
        all.all_mint_role.key,
        &[],
        &[ExtensionType::MemoTransfer],
    )?;

    invoke(
        &ix,
        &[
            all.token_2022_program.to_account_info(),
            all.token_account.to_account_info(),
            all.all_mint_role.to_account_info(),
        ],
    )?;

    let ix = enable_required_transfer_memos(
        all.token_2022_program.key,
        &all.token_account.key(),
        all.all_mint_role.key,
        &[],
    )?;

    invoke(
        &ix,
        &[
            all.token_2022_program.to_account_info(),
            all.token_account.to_account_info(),
            all.all_mint_role.to_account_info(),
        ],
    )?;

    Ok(())
}
