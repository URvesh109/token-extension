use {
    anchor_lang::prelude::*,
    anchor_spl::{
        token_2022::{close_account, CloseAccount},
        token_interface::{Mint, Token2022},
    },
};

#[derive(Accounts)]
pub struct CloseMintAccount<'info> {
    #[account(
        mut,
        mint::token_program = Token2022::id()
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_2022_program: Program<'info, Token2022>,
    pub destination: SystemAccount<'info>,
    pub authority: SystemAccount<'info>,
}

impl<'info> CloseMintAccount<'info> {
    fn close_account_cpi(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        CpiContext::new(
            self.token_2022_program.to_account_info(),
            CloseAccount {
                account: self.mint.to_account_info(),
                destination: self.destination.to_account_info(),
                authority: self.authority.to_account_info(),
            },
        )
    }
}

pub(crate) fn handler(ctx: Context<CloseMintAccount>) -> Result<()> {
    let all = ctx.accounts;

    close_account(all.close_account_cpi())?;
    Ok(())
}
