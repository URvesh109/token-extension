use {
    crate::error::ErrorCode,
    anchor_lang::{
        prelude::*,
        solana_program::{program::invoke, system_instruction},
    },
    anchor_spl::{
        token_2022::{initialize_mint2, InitializeMint2},
        token_interface::{Mint, Token2022},
    },
    spl_token_2022::extension::{
        group_member_pointer::instruction::initialize, group_pointer::GroupPointer,
        BaseStateWithExtensions, StateWithExtensions,
    },
    // spl_token_group_interface::instruction::initialize_member,
};

#[derive(Accounts)]
pub struct InitializeMemberPointer<'info> {
    #[account(
        mut,
        owner = System::id() @ ErrorCode::InvalidAccountOwner,
        constraint = member.data_is_empty() @ ErrorCode::AlreadyInUse
    )]
    pub member: Signer<'info>,
    /// CHECK:
    #[account(mut)]
    pub group: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub all_mint_role: Signer<'info>,
    pub token_2022_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> InitializeMemberPointer<'info> {
    fn initialize_mint_2_cpi(&self) -> CpiContext<'_, '_, '_, 'info, InitializeMint2<'info>> {
        CpiContext::new(
            self.token_2022_program.to_account_info(),
            InitializeMint2 {
                mint: self.member.to_account_info(),
            },
        )
    }
}

pub(crate) fn handler_to_initialize_member_pointer(
    ctx: Context<InitializeMemberPointer>,
    mint_len: u64,
    decimals: u8,
) -> Result<()> {
    let all = ctx.accounts;

    let account_info = all.group.to_account_info();
    let account_data = account_info.data.borrow();
    let mint_account = StateWithExtensions::<spl_token_2022::state::Mint>::unpack(&account_data)?;

    let group_pointer = mint_account.get_extension::<GroupPointer>()?;

    let group_address = Option::<Pubkey>::from(group_pointer.group_address)
        .ok_or(ErrorCode::InvalidGroupAddress)?;

    require!(
        group_address == all.group.key(),
        ErrorCode::InvalidGroupAddress
    );

    invoke(
        &system_instruction::create_account(
            all.payer.key,
            &all.member.key(),
            Rent::get()?.minimum_balance((mint_len) as usize),
            mint_len,
            all.token_2022_program.key,
        ),
        &[all.payer.to_account_info(), all.member.to_account_info()],
    )?;

    let ix = initialize(
        all.token_2022_program.key,
        all.member.key,
        Some(all.all_mint_role.key()),
        Some(all.member.key()),
    )?;

    invoke(&ix, &[all.member.to_account_info()])?;

    initialize_mint2(
        all.initialize_mint_2_cpi(),
        decimals,
        all.all_mint_role.key,
        None,
    )?;

    //TODO: fix this issue: "Error: Invalid instruction"
    // let ix = initialize_member(
    //     all.token_2022_program.key,
    //     &all.member.key(),
    //     &all.member.key(),
    //     all.all_mint_role.key,
    //     &all.group.key(),
    //     all.all_mint_role.key,
    // );

    // invoke(
    //     &ix,
    //     &[
    //         all.member.to_account_info(),
    //         all.member.to_account_info(),
    //         all.all_mint_role.to_account_info(),
    //         all.group.to_account_info(),
    //     ],
    // )?;

    Ok(())
}
