use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid account owner")]
    InvalidAccountOwner,
    #[msg("Invalid program owner")]
    InvalidProgramOwner,
    #[msg("Provided mint address is already in use")]
    AlreadyInUse,
    #[msg("Five sources are supported as now")]
    InvalidRemainingAccounts,
    #[msg("Invalid Account State")]
    InvalidAccountState,
}
