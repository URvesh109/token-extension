use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke, system_instruction},
};

use crate::error::ErrorCode;
use anchor_spl::{
    token_2022::{
        initialize_mint2, mint_to,
        spl_token_2022::extension::transfer_fee::instruction::{
            harvest_withheld_tokens_to_mint, initialize_transfer_fee_config,
            transfer_checked_with_fee, withdraw_withheld_tokens_from_accounts,
            withdraw_withheld_tokens_from_mint,
        },
        InitializeMint2, MintTo, Token2022,
    },
    token_interface::{
        spl_token_2022::extension::StateWithExtensionsMut, Mint, TokenAccount, TokenInterface,
    },
};

use anchor_spl::token_2022::spl_token_2022;

#[derive(Accounts)]
pub struct TransferFeeConfig<'info> {
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

pub(crate) fn handler(
    ctx: Context<TransferFeeConfig>,
    data_len: u64,
    transfer_fee_config_authority: Option<Pubkey>,
    withdraw_withheld_authority: Option<Pubkey>,
    transfer_fee_basis_points: u16,
    maximum_fee: u64,
) -> Result<()> {
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

    let ix = initialize_transfer_fee_config(
        &all.token_2022_program.key(),
        &all.mint.key(),
        transfer_fee_config_authority.as_ref(),
        withdraw_withheld_authority.as_ref(),
        transfer_fee_basis_points,
        maximum_fee,
    )?;

    invoke(
        &ix,
        &[
            all.mint.to_account_info(),
            all.token_2022_program.to_account_info(),
        ],
    )?;

    initialize_mint2(
        all.initialize_mint_2_cpi(),
        2,
        &all.all_mint_role.key(),
        None,
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct MintToAccount<'info> {
    #[account(
        mut,
        mint::token_program = Token2022::id()
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_2022_program: Interface<'info, TokenInterface>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = authority,
        associated_token::token_program = Token2022::id()
    )]
    pub associated_token: InterfaceAccount<'info, TokenAccount>,
    pub authority: Signer<'info>,
}

impl<'info> MintToAccount<'info> {
    fn mint_to_cpi(&self) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
        CpiContext::new(
            self.token_2022_program.to_account_info(),
            MintTo {
                mint: self.mint.to_account_info(),
                to: self.associated_token.to_account_info(),
                authority: self.authority.to_account_info(),
            },
        )
    }
}

pub(crate) fn handler_for_mint_to(ctx: Context<MintToAccount>, amount: u64) -> Result<()> {
    let all = ctx.accounts;

    mint_to(all.mint_to_cpi(), amount)?;
    Ok(())
}

#[derive(Accounts)]
pub struct TransferToAccount<'info> {
    #[account(
        mint::token_program = Token2022::id()
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = authority,
        associated_token::token_program = Token2022::id()
    )]
    pub from_acc: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub to_acc: InterfaceAccount<'info, TokenAccount>,
    pub token_2022_program: Interface<'info, TokenInterface>,
    pub authority: Signer<'info>,
}

pub(crate) fn handler_for_transfer_to_account(
    ctx: Context<TransferToAccount>,
    amount: u64,
    fee: u64,
) -> Result<()> {
    let all = ctx.accounts;

    let ix = transfer_checked_with_fee(
        all.token_2022_program.key,
        &all.from_acc.key(),
        &all.mint.key(),
        &all.to_acc.key(),
        all.authority.key,
        &[],
        amount,
        all.mint.decimals,
        fee,
    )?;

    invoke(
        &ix,
        &[
            all.mint.to_account_info(),
            all.from_acc.to_account_info(),
            all.to_acc.to_account_info(),
            all.authority.to_account_info(),
            all.token_2022_program.to_account_info(),
        ],
    )?;
    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawFromWithheldAccount<'info> {
    #[account(
        mint::token_program = Token2022::id()
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = authority,
        associated_token::token_program = Token2022::id()
    )]
    pub destination: InterfaceAccount<'info, TokenAccount>,
    pub token_2022_program: Interface<'info, TokenInterface>,
    pub authority: Signer<'info>,
}

pub(crate) fn handler_for_withdraw_withheld_account<'a>(
    ctx: Context<'_, '_, '_, 'a, WithdrawFromWithheldAccount<'a>>,
) -> Result<()> {
    let all = ctx.accounts;

    let (sources, mut infos) = filter_sources_account_info(ctx.remaining_accounts)?;

    let ix = withdraw_withheld_tokens_from_accounts(
        all.token_2022_program.key,
        &all.mint.key(),
        &all.destination.key(),
        all.authority.key,
        &[],
        &sources,
    )?;

    infos.push(all.token_2022_program.to_account_info());
    infos.push(all.mint.to_account_info());
    infos.push(all.destination.to_account_info());
    infos.push(all.authority.to_account_info());

    invoke(&ix, &infos)?;

    Ok(())
}

#[derive(Accounts)]
pub struct HarvestWithheldToken<'info> {
    #[account(
        mut,
        mint::token_program = Token2022::id()
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_2022_program: Interface<'info, TokenInterface>,
}

pub(crate) fn handler_for_harvest_withheld_token<'a>(
    ctx: Context<'_, '_, '_, 'a, HarvestWithheldToken<'a>>,
) -> Result<()> {
    let all = ctx.accounts;

    let (sources, mut infos) = filter_sources_account_info(ctx.remaining_accounts)?;

    let ix =
        harvest_withheld_tokens_to_mint(all.token_2022_program.key, &all.mint.key(), &sources)?;

    infos.push(all.token_2022_program.to_account_info());
    infos.push(all.mint.to_account_info());

    invoke(&ix, &infos)?;

    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawFromWithheldMint<'info> {
    #[account(
        mut,
        mint::token_program = Token2022::id()
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = authority,
        associated_token::token_program = Token2022::id()
    )]
    pub destination: InterfaceAccount<'info, TokenAccount>,
    pub token_2022_program: Interface<'info, TokenInterface>,
    pub authority: Signer<'info>,
}

pub(crate) fn handler_for_withdraw_withheld_mint(
    ctx: Context<WithdrawFromWithheldMint>,
) -> Result<()> {
    let all = ctx.accounts;

    let ix = withdraw_withheld_tokens_from_mint(
        all.token_2022_program.key,
        &all.mint.key(),
        &all.destination.key(),
        all.authority.key,
        &[],
    )?;

    invoke(
        &ix,
        &[
            all.token_2022_program.to_account_info(),
            all.mint.to_account_info(),
            all.destination.to_account_info(),
            all.authority.to_account_info(),
        ],
    )?;

    Ok(())
}

fn filter_sources_account_info<'a, 'info>(
    rem_accs: &'a [AccountInfo<'info>],
) -> Result<(Vec<&'a Pubkey>, Vec<AccountInfo<'info>>)> {
    require!(
        !rem_accs.is_empty() && rem_accs.len() <= 5,
        ErrorCode::InvalidRemainingAccounts
    );

    let mut sources = Vec::new();
    let mut acc_infos = Vec::new();

    for acc_info in rem_accs {
        let account_info = acc_info.to_account_info();
        let mut account_data = account_info.data.borrow_mut();

        let mut token_account =
            StateWithExtensionsMut::<spl_token_2022::state::Account>::unpack(&mut account_data)?;

        let token_account_extension = token_account
            .get_extension_mut::<spl_token_2022::extension::transfer_fee::TransferFeeAmount>(
        )?;

        let account_withheld_amount = u64::from(token_account_extension.withheld_amount);

        if acc_info.owner.key() == Token2022::id() && account_withheld_amount != 0 {
            sources.push(acc_info.key);
            acc_infos.push(acc_info.to_account_info());
        }
    }
    Ok((sources, acc_infos))
}
