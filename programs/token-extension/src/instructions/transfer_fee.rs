use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke, system_instruction},
};

use crate::error::ErrorCode;
use anchor_spl::token_2022::{
    initialize_mint2, InitializeMint2, Token2022,
    spl_token_2022::extension::transfer_fee::instruction::initialize_transfer_fee_config,
};


#[derive(Accounts)]
pub struct TransferFeeConfig<'info> {
    #[account(
        mut, 
        owner= System::id() @ ErrorCode::InvalidAccountOwner,
        constraint = mint.data_is_empty() @ ErrorCode::AlreadyInUse
    )]
    pub mint:Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub all_mint_role: Signer<'info>,
    pub token_2022_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>
}

impl<'info> TransferFeeConfig<'info> {

    fn initialize_mint_2_cpi(&self) -> CpiContext<'_, '_, '_, 'info, InitializeMint2<'info>> {
        CpiContext::new(
            self.token_2022_program.to_account_info(),
            InitializeMint2 {
                mint: self.mint.to_account_info(),
            },
        )
    }
}

pub(crate) fn handler(ctx:Context<TransferFeeConfig>,data_len: u64, transfer_fee_config_authority: Option<Pubkey>,withdraw_withheld_authority: Option<Pubkey>, transfer_fee_basis_points: u16, maximum_fee: u64) -> Result<()> {
    let all = ctx.accounts;

    invoke(
        &system_instruction::create_account(
            &all.payer.key(),
            &all.mint.key(),
            Rent::get()?.minimum_balance(data_len as usize),
            data_len,
            &Token2022::id(),
        ),
        &[
            all.payer.to_account_info(),
            all.mint.to_account_info(),
            all.system_program.to_account_info(),
        ],
    )?;

    let ix = initialize_transfer_fee_config(&all.token_2022_program.key(), &all.mint.key(), transfer_fee_config_authority.as_ref(), withdraw_withheld_authority.as_ref(), transfer_fee_basis_points, maximum_fee)?;

    invoke(
        &ix, 
        &[
            all.mint.to_account_info(),
            all.token_2022_program.to_account_info(),
        ])?;

    initialize_mint2(
        all.initialize_mint_2_cpi(),
        6,
        &all.all_mint_role.key(),
        None,
    )?;

    Ok(())
}