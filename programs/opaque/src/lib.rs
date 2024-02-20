use anchor_lang::prelude::*;

declare_id!("GFZBH5E5peCPF6KZPzXQpx4YiWmqSwMZHsmG1yF9fvai");

#[program]
pub mod opaque {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
