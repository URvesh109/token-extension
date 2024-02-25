use {
    anchor_lang::{
        prelude::*,
        solana_program::{program::invoke, system_instruction},
    },
    anchor_spl::{
        token_2022::{initialize_mint2, InitializeMint2},
        token_interface::{
            spl_token_2022::extension::metadata_pointer::instruction::initialize, Mint, Token2022,
        },
    },
    spl_token_metadata_interface::{
        instruction::{initialize as initialize_metadata, update_field},
        state::Field as MetaField,
    },
};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub enum Field {
    /// The name field, corresponding to `TokenMetadata.name`
    Name,
    /// The symbol field, corresponding to `TokenMetadata.symbol`
    Symbol,
    /// The uri field, corresponding to `TokenMetadata.uri`
    Uri,
    /// A user field, whose key is given by the associated string
    Key(String),
}

impl Into<MetaField> for Field {
    fn into(self) -> MetaField {
        match self {
            Field::Name => MetaField::Name,
            Field::Symbol => MetaField::Symbol,
            Field::Uri => MetaField::Uri,
            Field::Key(v) => MetaField::Key(v),
        }
    }
}

use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct MetadataPointer<'info> {
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

impl<'info> MetadataPointer<'info> {
    fn initialize_mint_2_cpi(&self) -> CpiContext<'_, '_, '_, 'info, InitializeMint2<'info>> {
        CpiContext::new(
            self.token_2022_program.to_account_info(),
            InitializeMint2 {
                mint: self.mint.to_account_info(),
            },
        )
    }
}

pub(crate) fn handler_to_initialize_metadata_pointer(
    ctx: Context<MetadataPointer>,
    mint_len: u64,
    decimals: u8,
) -> Result<()> {
    let all = ctx.accounts;

    invoke(
        &system_instruction::create_account(
            all.payer.key,
            &all.mint.key(),
            Rent::get()?.minimum_balance(mint_len as usize),
            mint_len,
            all.token_2022_program.key,
        ),
        &[
            all.payer.to_account_info(),
            all.mint.to_account_info(),
            all.system_program.to_account_info(),
        ],
    )?;

    let ix = initialize(
        all.token_2022_program.key,
        &all.mint.key(),
        Some(all.all_mint_role.key()),
        Some(all.mint.key()),
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
        &all.all_mint_role.key(),
        None,
    )?;

    Ok(())
}
