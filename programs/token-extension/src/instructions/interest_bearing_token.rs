use {
    crate::error::ErrorCode,
    anchor_lang::{
        prelude::*,
        solana_program::{program::invoke, system_instruction},
    },
    anchor_spl::{
        token_2022::{
            amount_to_ui_amount, initialize_mint2,
            spl_token_2022::extension::interest_bearing_mint::instruction::initialize,
            AmountToUiAmount, InitializeMint2,
        },
        token_interface::{Mint, Token2022},
    },
};

#[derive(Accounts)]
pub struct InterestBearingToken<'info> {
    #[account(
        mut,
        owner= System::id() @ ErrorCode::InvalidAccountOwner,
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

impl<'info> InterestBearingToken<'info> {
    fn initialize_mint_2_cpi(&self) -> CpiContext<'_, '_, '_, 'info, InitializeMint2<'info>> {
        CpiContext::new(
            self.token_2022_program.to_account_info(),
            InitializeMint2 {
                mint: self.mint.to_account_info(),
            },
        )
    }
}

pub(crate) fn handler_to_interest_bearing_token(
    ctx: Context<InterestBearingToken>,
    mint_len: u64,
    rate: i16,
) -> Result<()> {
    let all = ctx.accounts;
    invoke(
        &system_instruction::create_account(
            all.payer.key,
            all.mint.key,
            Rent::get()?.minimum_balance(mint_len as usize),
            mint_len,
            &Token2022::id(),
        ),
        &[all.payer.to_account_info(), all.mint.to_account_info()],
    )?;

    let ix = initialize(
        all.token_2022_program.key,
        all.mint.key,
        Some(all.all_mint_role.key()),
        rate,
    )?;

    invoke(
        &ix,
        &[
            all.token_2022_program.to_account_info(),
            all.mint.to_account_info(),
        ],
    )?;

    initialize_mint2(all.initialize_mint_2_cpi(), 2, all.all_mint_role.key, None)?;

    Ok(())
}

#[derive(Accounts)]
pub struct AmountToUI<'info> {
    #[account(
        mint::token_program = Token2022::id()
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_2022_program: Program<'info, Token2022>,
}

impl<'info> AmountToUI<'info> {
    fn amount_to_ui_amount_cpi(&self) -> CpiContext<'_, '_, '_, 'info, AmountToUiAmount<'info>> {
        CpiContext::new(
            self.token_2022_program.to_account_info(),
            AmountToUiAmount {
                account: self.mint.to_account_info(),
            },
        )
    }
}

pub(crate) fn handle_amount_to_ui(ctx: Context<AmountToUI>, amount: u64) -> Result<String> {
    let all = ctx.accounts;
    amount_to_ui_amount(all.amount_to_ui_amount_cpi(), amount)
}
