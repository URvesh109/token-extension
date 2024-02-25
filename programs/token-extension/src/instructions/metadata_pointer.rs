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

impl From<Field> for MetaField {
    fn from(value: Field) -> Self {
        match value {
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
    name: String,
    symbol: String,
    uri: String,
) -> Result<()> {
    let all = ctx.accounts;

    require!(!name.is_empty(), ErrorCode::InvalidName); // simple check
    require!(!symbol.is_empty(), ErrorCode::InvalidSymbol); // simple check
    require!(!uri.is_empty(), ErrorCode::InvalidUri); // simple check or can use url crate to perform all checks

    invoke(
        &system_instruction::create_account(
            all.payer.key,
            &all.mint.key(),
            Rent::get()?.minimum_balance((mint_len * 2) as usize),
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
            all.mint.to_account_info(),
        ],
    )?;

    initialize_mint2(
        all.initialize_mint_2_cpi(),
        decimals,
        &all.all_mint_role.key(),
        None,
    )?;

    let metadata_ix = initialize_metadata(
        all.token_2022_program.key,
        all.mint.key,
        all.all_mint_role.key,
        all.mint.key,
        all.all_mint_role.key,
        name,
        symbol,
        uri,
    );

    invoke(
        &metadata_ix,
        &[
            all.token_2022_program.to_account_info(),
            all.mint.to_account_info(),
            all.all_mint_role.to_account_info(),
        ],
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateMetadataField<'info> {
    #[account(
        mut,
        mint::token_program = Token2022::id(),
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub update_authority: Signer<'info>,
    pub token_2022_program: Program<'info, Token2022>,
}

pub(crate) fn handler_to_update_metadata_field(
    ctx: Context<UpdateMetadataField>,
    field: Field,
    value: String,
) -> Result<()> {
    let all = ctx.accounts;

    let update_ix = update_field(
        all.token_2022_program.key,
        &all.mint.key(),
        all.update_authority.key, // gets validated here
        field.into(),
        value,
    );

    invoke(
        &update_ix,
        &[
            all.token_2022_program.to_account_info(),
            all.mint.to_account_info(),
            all.update_authority.to_account_info(),
        ],
    )?;

    Ok(())
}
