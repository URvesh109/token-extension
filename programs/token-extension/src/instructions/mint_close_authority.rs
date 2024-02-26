use {
    crate::error::ErrorCode,
    anchor_lang::{
        prelude::*,
        solana_program::{program::invoke, system_instruction},
    },
    anchor_spl::token_2022::{
        self, initialize_mint2, initialize_mint_close_authority, InitializeMint2,
        InitializeMintCloseAuthority, Token2022,
    },
};

#[derive(Accounts)]
pub struct MintCloseAuthority<'info> {
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

impl<'info> MintCloseAuthority<'info> {
    fn initialize_mint_close_authority_cpi(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, InitializeMintCloseAuthority<'info>> {
        CpiContext::new(
            self.token_2022_program.to_account_info(),
            InitializeMintCloseAuthority {
                mint: self.mint.to_account_info(),
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

pub(crate) fn handler(ctx: Context<MintCloseAuthority>, data_len: u64) -> Result<()> {
    let all = ctx.accounts;

    invoke(
        &system_instruction::create_account(
            all.payer.key,
            all.mint.key,
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

    initialize_mint_close_authority(
        all.initialize_mint_close_authority_cpi(),
        Some(&all.all_mint_role.key()),
    )?;

    initialize_mint2(all.initialize_mint_2_cpi(), 6, all.all_mint_role.key, None)?;
    Ok(())
}
