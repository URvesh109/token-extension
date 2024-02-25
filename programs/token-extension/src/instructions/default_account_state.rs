use {
    crate::error::ErrorCode,
    anchor_lang::{
        prelude::*,
        solana_program::{program::invoke, system_instruction},
    },
    anchor_spl::{
        token_2022::{
            self, initialize_mint2,
            spl_token_2022::{
                extension::default_account_state::instruction::{
                    initialize_default_account_state, update_default_account_state,
                },
                state::AccountState,
            },
        },
        token_interface::{InitializeMint2, Mint, Token2022},
    },
};

#[derive(Accounts)]
pub struct DefaultAccountState<'info> {
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

impl<'info> DefaultAccountState<'info> {
    fn initialize_mint_2_cpi(&self) -> CpiContext<'_, '_, '_, 'info, InitializeMint2<'info>> {
        CpiContext::new(
            self.token_2022_program.to_account_info(),
            InitializeMint2 {
                mint: self.mint.to_account_info(),
            },
        )
    }
}

pub(crate) fn handler_for_default_account_state(
    ctx: Context<DefaultAccountState>,
    data_len: u64,
) -> Result<()> {
    let all = ctx.accounts;

    invoke(
        &system_instruction::create_account(
            &all.payer.key(),
            &all.mint.key(),
            Rent::get()?.minimum_balance(data_len as usize),
            data_len,
            &token_2022::ID,
        ),
        &[
            all.payer.to_account_info(),
            all.mint.to_account_info(),
            all.system_program.to_account_info(),
        ],
    )?;

    let ix = initialize_default_account_state(
        all.token_2022_program.key,
        all.mint.key,
        &AccountState::Frozen,
    )?;

    invoke(
        &ix,
        &[
            all.token_2022_program.to_account_info(),
            all.mint.to_account_info(),
        ],
    )?;

    initialize_mint2(
        all.initialize_mint_2_cpi(),
        2,
        all.all_mint_role.key,
        Some(all.all_mint_role.key),
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateDefaultAccountState<'info> {
    #[account(
        mut,
        mint::token_program = Token2022::id()
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_2022_program: Program<'info, Token2022>,
    pub freeze_auth: SystemAccount<'info>,
}

pub(crate) fn handler_for_update_default_account_state(
    ctx: Context<UpdateDefaultAccountState>,
    account_state: u8,
) -> Result<()> {
    let all = ctx.accounts;

    let account_state = AccountState::try_from(account_state)
        .map_err(|_| error!(ErrorCode::InvalidAccountState))?;

    let ix = update_default_account_state(
        all.token_2022_program.key,
        &all.mint.key(),
        all.freeze_auth.key,
        &[],
        &account_state,
    )?;

    invoke(
        &ix,
        &[
            all.token_2022_program.to_account_info(),
            all.mint.to_account_info(),
            all.freeze_auth.to_account_info(),
        ],
    )?;
    Ok(())
}
