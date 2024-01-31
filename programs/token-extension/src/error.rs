use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid account owner")]
    InvalidAccountOwner,
    #[msg("Provided mint address is already in use")]
    AlreadyInUse,
}
