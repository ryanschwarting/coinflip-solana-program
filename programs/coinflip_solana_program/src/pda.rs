// use std::default;
// use anchor_lang::prelude::*;
// use solana_program::system_program::ID as SYSTEM_PROGRAM_ID;
// use orao_solana_vrf::program::OraoVrf;
// use orao_solana_vrf::state::NetworkState;
// use orao_solana_vrf::{CONFIG_ACCOUNT_SEED, RANDOMNESS_ACCOUNT_SEED};

// #[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
// pub enum Status {
//     Waiting,
//     Processing,
//     Finished
// }

// impl Default for Status {
//     fn default() -> Self {
//         Status::Waiting
//     }
// }

// #[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
// pub enum GameResult {
//     PlayerWin,
//     HouseWin,
//     Tie
// }

// #[account]
// pub struct Coinflip {
//     pub player: Pubkey,
//     pub amount: u64,
//     pub force: [u8; 32],
//     pub result: Option<GameResult>,
//     pub status: Status
// }

// #[derive(Accounts)]
// #[instruction(room_id: [u8; 32], amount: u64)]

// pub struct CreateCoinflip<'info> {
//     #[account(mut)]
//     pub player: Signer<'info>,

//     #[account(
//         init,
//         space = 8 + std::mem::size_of::<Coinflip>(),
//         payer = player,
//         seeds = [b"coinflip", room_id.as_ref()],
//         bump
//     )]
//     pub coinflip: Account<'info, Coinflip>,

//     /// CHECK: This is the house treasury account
//     #[account(mut)]
//     pub house_treasury: AccountInfo<'info>,

//     pub system_program: Program<'info, System>,
// }

// #[derive(Accounts)]
// #[instruction(room_id: [u8; 32], force: [u8; 32])]
// pub struct PlayCoinflip<'info> {
//     #[account(mut)]
//     pub player: Signer<'info>,

//     #[account(
//         mut, 
//         seeds = [b"coinflip", room_id.as_ref()],
//         constraint = coinflip.player == player.key(),
//         bump
//     )] 
//     pub coinflip: Account<'info, Coinflip>,

//     /// CHECK: Treasury (house account)
//     #[account(mut)]
//     pub house_treasury: AccountInfo<'info>,

//     /// CHECK: Randomness
//     #[account(
//         mut,
//         seeds = [RANDOMNESS_ACCOUNT_SEED.as_ref(), &force],
//         bump,
//         seeds::program = orao_solana_vrf::ID
//     )]
//     pub random: AccountInfo<'info>,

//     #[account(
//         mut,
//         seeds = [CONFIG_ACCOUNT_SEED.as_ref()],
//         bump,
//         seeds::program = orao_solana_vrf::ID
//     )]
//     pub config: Account<'info, NetworkState>,

//     pub vrf: Program<'info, OraoVrf>,
    
//     pub system_program: Program<'info, System>,
// }

// #[derive(Accounts)]
// #[instruction(room_id: [u8; 32], force: [u8; 32])]
// pub struct ResultCoinflip<'info> {
//     #[account(mut)]
//     pub player: AccountInfo<'info>,

//     #[account(
//         mut, 
//         seeds = [b"coinflip", room_id.as_ref()],
//         constraint = coinflip.status == Status::Processing && coinflip.player == player.key(),
//         bump
//     )] 
//     pub coinflip: Account<'info, Coinflip>,

//     /// CHECK: House treasury account
//     #[account(mut)]
//     pub house_treasury: AccountInfo<'info>,


//     /// CHECK: Randomness
//     #[account(
//         mut,
//         seeds = [RANDOMNESS_ACCOUNT_SEED.as_ref(), &force],
//         bump,
//         seeds::program = orao_solana_vrf::ID
//     )]
//     pub random: AccountInfo<'info>,

//     #[account(
//         mut,
//         seeds = [CONFIG_ACCOUNT_SEED.as_ref()],
//         bump,
//         seeds::program = orao_solana_vrf::ID
//     )]
//     pub config: Account<'info, NetworkState>,

//     pub vrf: Program<'info, OraoVrf>,
    
//     pub system_program: Program<'info, System>,
// }

use std::default;
use anchor_lang::prelude::*;
use solana_program::system_program::ID as SYSTEM_PROGRAM_ID;
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
    PlayerWin,
    HouseWin,
    Tie
}

#[account]
pub struct Coinflip {
    pub player: Pubkey,
    pub amount: u64,
    pub force: [u8; 32],
    pub result: Option<GameResult>,
    pub status: Status
}

#[derive(Accounts)]
#[instruction(room_id: String, amount: u64)]
pub struct CreateCoinflip<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        init,
        space = 8 + std::mem::size_of::<Coinflip>(),
        payer = player,
        seeds = [b"coinflip", room_id.as_bytes()],
        bump
    )]
    pub coinflip: Account<'info, Coinflip>,

    /// CHECK: This is the house treasury account
    #[account(mut)]
    pub house_treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
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
        bump
    )] 
    pub coinflip: Account<'info, Coinflip>,

    /// CHECK: Treasury (house account)
    #[account(mut)]
    pub house_treasury: AccountInfo<'info>,

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
    pub player: AccountInfo<'info>,

    #[account(
        mut, 
        seeds = [b"coinflip", room_id.as_bytes()],
        constraint = coinflip.status == Status::Processing && coinflip.player == player.key(),
        bump
    )] 
    pub coinflip: Account<'info, Coinflip>,

    /// CHECK: House treasury account
    #[account(mut)]
    pub house_treasury: AccountInfo<'info>,

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