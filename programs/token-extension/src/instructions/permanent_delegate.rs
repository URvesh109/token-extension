use {
    crate::error::ErrorCode,
    anchor_lang::{
        prelude::*,
        solana_program::{program::invoke, system_instruction},
    },
    anchor_spl::{
        associated_token::{
            create_idempotent, get_associated_token_address_with_program_id, AssociatedToken,
            Create,
        },
        token_2022::{burn, initialize_mint2, Burn, InitializeMint2, Token2022},
        token_interface::{
            spl_token_2022::instruction::initialize_permanent_delegate, Mint, TokenAccount,
            TokenInterface,
        },
    },
};

#[derive(Accounts)]
pub struct PermanentDelegate<'info> {
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

impl<'info> PermanentDelegate<'info> {
    fn initialize_mint_2_cpi(&self) -> CpiContext<'_, '_, '_, 'info, InitializeMint2<'info>> {
        CpiContext::new(
            self.token_2022_program.to_account_info(),
            InitializeMint2 {
                mint: self.mint.to_account_info(),
            },
        )
    }
}

pub(crate) fn handler_to_permanent_delegate(
    ctx: Context<PermanentDelegate>,
    mint_len: u64,
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
        &[
            all.payer.to_account_info(),
            all.mint.to_account_info(),
            all.system_program.to_account_info(),
        ],
    )?;

    let ix = initialize_permanent_delegate(
        all.token_2022_program.key,
        all.mint.key,
        all.all_mint_role.key,
    )?;

    invoke(
        &ix,
        &[
            all.token_2022_program.to_account_info(),
            all.mint.to_account_info(),
            all.all_mint_role.to_account_info(),
        ],
    )?;

    initialize_mint2(all.initialize_mint_2_cpi(), 0, all.all_mint_role.key, None)
}

#[derive(Accounts)]
pub struct CreateATA<'info> {
    #[account(
        mint::token_program = Token2022::id()
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub payer: Signer<'info>,

    ///CHECK: Associated token acc
    #[account(
        mut,
        address = get_associated_token_address_with_program_id(wallet.key, &mint.key(), token_2022_program.key) @ ErrorCode::InvalidATA
    )]
    pub associated_token: UncheckedAccount<'info>,
    pub wallet: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    pub token_2022_program: Program<'info, Token2022>,
    pub associated_program: Program<'info, AssociatedToken>,
}

impl<'info> CreateATA<'info> {
    pub fn create_ata_cpi(&self) -> CpiContext<'_, '_, '_, 'info, Create<'info>> {
        CpiContext::new(
            self.associated_program.to_account_info(),
            Create {
                payer: self.payer.to_account_info(),
                associated_token: self.associated_token.to_account_info(),
                authority: self.wallet.to_account_info(),
                mint: self.mint.to_account_info(),
                system_program: self.system_program.to_account_info(),
                token_program: self.token_2022_program.to_account_info(),
            },
        )
    }
}

pub(crate) fn handler_to_create_ata(ctx: Context<CreateATA>) -> Result<()> {
    let all = ctx.accounts;

    create_idempotent(all.create_ata_cpi())
}

#[derive(Accounts)]
pub struct BurnCpi<'info> {
    #[account(
        mut,
        mint::token_program = Token2022::id()
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub from: InterfaceAccount<'info, TokenAccount>,
    pub token_2022_program: Interface<'info, TokenInterface>,
    pub delegate: Signer<'info>,
}

impl<'info> BurnCpi<'info> {
    fn burn_cpi(&self) -> CpiContext<'_, '_, '_, 'info, Burn<'info>> {
        CpiContext::new(
            self.token_2022_program.to_account_info(),
            Burn {
                mint: self.mint.to_account_info(),
                from: self.from.to_account_info(),
                authority: self.delegate.to_account_info(),
            },
        )
    }
}

pub(crate) fn handler_to_burn(ctx: Context<BurnCpi>, amount: u64) -> Result<()> {
    let all = ctx.accounts;

    burn(all.burn_cpi(), amount)
}
