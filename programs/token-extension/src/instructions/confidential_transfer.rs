use {
    crate::error::ErrorCode,
    anchor_lang::{
        prelude::*,
        solana_program::{program::invoke, system_instruction},
    },
    anchor_spl::{
        token_2022::{initialize_account3, initialize_mint2, InitializeAccount3, InitializeMint2},
        token_interface::{Mint, Token2022},
    },
    spl_token_2022::extension::confidential_transfer::instruction::initialize_mint,
};

#[derive(Accounts)]
pub struct InitializeConfidentialMint<'info> {
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

impl<'info> InitializeConfidentialMint<'info> {
    fn initialize_mint_2_cpi(&self) -> CpiContext<'_, '_, '_, 'info, InitializeMint2<'info>> {
        CpiContext::new(
            self.token_2022_program.to_account_info(),
            InitializeMint2 {
                mint: self.mint.to_account_info(),
            },
        )
    }
}

pub(crate) fn handler_to_initialize_confidential_mint(
    ctx: Context<InitializeConfidentialMint>,
    mint_len: u64,
    decimals: u8,
) -> Result<()> {
    let all = ctx.accounts;

    invoke(
        &system_instruction::create_account(
            all.payer.key,
            all.mint.key,
            Rent::get()?.minimum_balance((mint_len) as usize),
            mint_len,
            all.token_2022_program.key,
        ),
        &[all.payer.to_account_info(), all.mint.to_account_info()],
    )?;

    let ix = initialize_mint(
        all.token_2022_program.key,
        all.mint.key,
        Some(all.all_mint_role.key()),
        true,
        None,
    )?;

    invoke(
        &ix,
        &[
            all.token_2022_program.to_account_info(),
            all.mint.to_account_info(),
            all.all_mint_role.to_account_info(),
        ],
    )?;

    initialize_mint2(
        all.initialize_mint_2_cpi(),
        decimals,
        all.all_mint_role.key,
        None,
    )?;
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeConfidentialAccount<'info> {
    #[account(
        mint::token_program = Token2022::id()
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        owner= System::id() @ ErrorCode::InvalidAccountOwner,
        constraint = token_account.data_is_empty() @ ErrorCode::AlreadyInUse
    )]
    pub token_account: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub owner: Signer<'info>,
    pub token_2022_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> InitializeConfidentialAccount<'info> {
    fn initialize_account3_cpi(&self) -> CpiContext<'_, '_, '_, 'info, InitializeAccount3<'info>> {
        CpiContext::new(
            self.token_2022_program.to_account_info(),
            InitializeAccount3 {
                mint: self.mint.to_account_info(),
                account: self.token_account.to_account_info(),
                authority: self.owner.to_account_info(),
            },
        )
    }
}

pub(crate) fn handler_to_initialize_confidential_account(
    ctx: Context<InitializeConfidentialAccount>,
    account_len: u64,
) -> Result<()> {
    let all = ctx.accounts;

    invoke(
        &system_instruction::create_account(
            all.payer.key,
            all.token_account.key,
            Rent::get()?.minimum_balance(account_len as usize),
            account_len,
            &Token2022::id(),
        ),
        &[
            all.payer.to_account_info(),
            all.token_account.to_account_info(),
            // all.system_program.to_account_info(),
        ],
    )?;

    initialize_account3(all.initialize_account3_cpi())?;

    //TODO: Work in progress

    Ok(())
}
