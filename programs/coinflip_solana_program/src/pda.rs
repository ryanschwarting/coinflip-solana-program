use anchor_lang::prelude::*;
use orao_solana_vrf::program::OraoVrf;
use orao_solana_vrf::state::NetworkState;
use orao_solana_vrf::{CONFIG_ACCOUNT_SEED, RANDOMNESS_ACCOUNT_SEED};

#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum Status {
    Waiting,
    Processing,
    Finished
}

impl Default for Status {
    fn default() -> Self {
        Status::Waiting
    }
}

#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum GameResult {
    Option1Wins,
    Option2Wins,
    Tie
}

#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PlayerChoice {
    Option1,
    Option2,
    Tie,
}

#[account]
pub struct HouseTreasury {
    pub authority: Pubkey,
    pub balance: u64,
    pub paused: bool,
}

#[account]
pub struct Coinflip {
    pub player: Pubkey,
    pub amount: u64,
    pub player_choice: PlayerChoice,
    pub force: [u8; 32],
    pub result: Option<GameResult>,
    pub status: Status,
    pub last_play_time: i64,
}

#[derive(Accounts)]
pub struct InitializeHouse<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 1,
        seeds = [b"house_treasury"],
        bump
    )]
    pub house_treasury: Account<'info, HouseTreasury>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundTreasury<'info> {
    #[account(mut)]
    pub funder: Signer<'info>,
    #[account(
        mut,
        seeds = [b"house_treasury"],
        bump
    )]
    pub house_treasury: Account<'info, HouseTreasury>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(room_id: String, amount: u64, player_choice: PlayerChoice)]
pub struct CreateCoinflip<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        init,
        payer = player,
        space = 8 + std::mem::size_of::<Coinflip>(),
        seeds = [b"coinflip", room_id.as_bytes()],
        bump
    )]
    pub coinflip: Account<'info, Coinflip>,

    #[account(mut)]
    pub house_treasury: Account<'info, HouseTreasury>,

    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

#[derive(Accounts)]
#[instruction(room_id: String, force: [u8; 32])]
pub struct PlayCoinflip<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        mut, 
        seeds = [b"coinflip", room_id.as_bytes()],
        constraint = coinflip.player == player.key(),
        constraint = coinflip.status == Status::Waiting,
        bump
    )] 
    pub coinflip: Account<'info, Coinflip>,

    #[account(mut)]
    pub house_treasury: Account<'info, HouseTreasury>,

    /// CHECK: This is the Orao VRF treasury account
    #[account(mut)]
    pub orao_treasury: AccountInfo<'info>,

    /// CHECK: Randomness
    #[account(
        mut,
        seeds = [RANDOMNESS_ACCOUNT_SEED.as_ref(), &force],
        bump,
        seeds::program = orao_solana_vrf::ID
    )]
    pub random: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [CONFIG_ACCOUNT_SEED.as_ref()],
        bump,
        seeds::program = orao_solana_vrf::ID
    )]
    pub config: Account<'info, NetworkState>,

    pub vrf: Program<'info, OraoVrf>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(room_id: String, force: [u8; 32])]
pub struct ResultCoinflip<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        mut, 
        seeds = [b"coinflip", room_id.as_bytes()],
        constraint = coinflip.status == Status::Processing && coinflip.player == player.key(),
        bump
    )] 
    pub coinflip: Account<'info, Coinflip>,

    #[account(
        mut,
        seeds = [b"house_treasury"],
        bump
    )]
    pub house_treasury: Account<'info, HouseTreasury>,

    /// CHECK: This is the Orao VRF treasury account
    pub orao_treasury: AccountInfo<'info>,

    /// CHECK: Randomness
    #[account(
        seeds = [RANDOMNESS_ACCOUNT_SEED.as_ref(), &force],
        bump,
        seeds::program = orao_solana_vrf::ID
    )]
    pub random: AccountInfo<'info>,

    #[account(
        seeds = [CONFIG_ACCOUNT_SEED.as_ref()],
        bump,
        seeds::program = orao_solana_vrf::ID
    )]
    pub config: Account<'info, NetworkState>,

    pub vrf: Program<'info, OraoVrf>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawHouseFunds<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"house_treasury"],
        bump,
        constraint = house_treasury.authority == authority.key()
    )]
    pub house_treasury: Account<'info, HouseTreasury>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(room_id: String, amount: u64, player_choice: PlayerChoice, force: [u8; 32])]
pub struct CreateAndPlayCoinflip<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        init,
        payer = player,
        space = 8 + std::mem::size_of::<Coinflip>(),
        seeds = [b"coinflip", room_id.as_bytes()],
        bump
    )]
    pub coinflip: Account<'info, Coinflip>,

    #[account(mut)]
    pub house_treasury: Account<'info, HouseTreasury>,

    /// CHECK: This is the Orao VRF treasury account
    #[account(mut)]
    pub orao_treasury: AccountInfo<'info>,

    /// CHECK: Randomness
    #[account(
        mut,
        seeds = [RANDOMNESS_ACCOUNT_SEED.as_ref(), &force],
        bump,
        seeds::program = orao_solana_vrf::ID
    )]
    pub random: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [CONFIG_ACCOUNT_SEED.as_ref()],
        bump,
        seeds::program = orao_solana_vrf::ID
    )]
    pub config: Account<'info, NetworkState>,

    pub vrf: Program<'info, OraoVrf>,
    
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}
