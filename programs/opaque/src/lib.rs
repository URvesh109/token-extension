use anchor_lang::{prelude::*, solana_program::system_instruction::transfer};

declare_id!("GFZBH5E5peCPF6KZPzXQpx4YiWmqSwMZHsmG1yF9fvai");

#[program]
pub mod opaque {

    use anchor_lang::solana_program::program::invoke;

    use super::*;

    // Used to demonstrate that the CPI Guarded account restrict opaque program call
    pub fn transfer_sol(ctx: Context<TransferSol>, lamports: u64) -> Result<()> {
        let all = ctx.accounts;
        let ix = transfer(all.from_wallet.key, all.to_wallet.key, lamports);

        invoke(
            &ix,
            &[
                all.from_wallet.to_account_info(),
                all.to_wallet.to_account_info(),
            ],
        )?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct TransferSol<'info> {
    #[account(mut)]
    pub from_wallet: Signer<'info>,
    #[account(mut)]
    pub to_wallet: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}
