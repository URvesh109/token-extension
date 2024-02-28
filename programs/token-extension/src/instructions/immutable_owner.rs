use {
    crate::error::ErrorCode,
    anchor_lang::{
        prelude::*,
        solana_program::{program::invoke, system_instruction},
    },
    anchor_spl::{
        token_2022::{
            initialize_account3, initialize_immutable_owner, initialize_mint2, InitializeAccount3,
            InitializeImmutableOwner, InitializeMint2,
        },
        token_interface::Token2022,
    },
};

#[derive(Accounts)]
pub struct ImmutableOwner<'info> {
    #[account(
        mut,
        owner= System::id() @ ErrorCode::InvalidAccountOwner,
        constraint = mint.data_is_empty() @ ErrorCode::AlreadyInUse
    )]
    pub mint: Signer<'info>,
    #[account(
        mut,
        owner= System::id() @ ErrorCode::InvalidAccountOwner,
        constraint = account.data_is_empty() @ ErrorCode::AlreadyInUse
    )]
    pub account: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub all_mint_role: Signer<'info>,
    pub token_2022_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> ImmutableOwner<'info> {
    fn initialize_immutable_owner_cpi(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, InitializeImmutableOwner<'info>> {
        CpiContext::new(
            self.token_2022_program.to_account_info(),
            InitializeImmutableOwner {
                account: self.account.to_account_info(),
            },
        )
    }

    fn initialize_account3_cpi(&self) -> CpiContext<'_, '_, '_, 'info, InitializeAccount3<'info>> {
        CpiContext::new(
            self.token_2022_program.to_account_info(),
            InitializeAccount3 {
                mint: self.mint.to_account_info(),
                account: self.account.to_account_info(),
                authority: self.all_mint_role.to_account_info(),
            },
        )
    }

    fn initialize_mint_2_cpi(&self) -> CpiContext<'_, '_, '_, 'info, InitializeMint2<'info>> {
        CpiContext::new(
            self.token_2022_program.to_account_info(),
            InitializeMint2 {
                mint: self.mint.to_account_info(),
            },
        )
    }
}

pub(crate) fn handler(ctx: Context<ImmutableOwner>, mint_len: u64, account_len: u64) -> Result<()> {
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

    initialize_mint2(all.initialize_mint_2_cpi(), 2, all.all_mint_role.key, None)?;

    invoke(
        &system_instruction::create_account(
            all.payer.key,
            all.account.key,
            Rent::get()?.minimum_balance(account_len as usize),
            account_len,
            &Token2022::id(),
        ),
        &[all.payer.to_account_info(), all.account.to_account_info()],
    )?;

    initialize_immutable_owner(all.initialize_immutable_owner_cpi())?;
    initialize_account3(all.initialize_account3_cpi())?;
    Ok(())
}
