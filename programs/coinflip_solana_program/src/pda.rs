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
    PlayerWin,
    HouseWin,
    Tie
}

#[account]
pub struct HouseTreasury {
    pub authority: Pubkey,
    pub balance: u64,
}

#[account]
pub struct Coinflip {
    pub player: Pubkey,
    pub amount: u64,
    pub force: [u8; 200],
    pub result: Option<GameResult>,
    pub status: Status
}

#[derive(Accounts)]
pub struct InitializeHouse<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8,
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
#[instruction(room_id: String, amount: u64)]
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
    pub player: AccountInfo<'info>,

    #[account(
        mut, 
        seeds = [b"coinflip", room_id.as_bytes()],
        constraint = coinflip.status == Status::Processing && coinflip.player == player.key(),
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

// use anchor_lang::prelude::*;

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
// pub struct HouseTreasury {
//     pub authority: Pubkey,
//     pub balance: u64,
// }

// #[account]
// pub struct Coinflip {
//     pub player: Pubkey,
//     pub amount: u64,
//     pub force: [u8; 32],
//     pub result: Option<GameResult>,
//     pub status: Status
// }

// #[account]
// pub struct MockVrfAccount {
//     pub randomness: Option<[u8; 32]>,
//     pub is_fulfilled: bool,
// }

// #[derive(Accounts)]
// pub struct InitializeHouse<'info> {
//     #[account(
//         init,
//         payer = authority,
//         space = 8 + 32 + 8,
//         seeds = [b"house_treasury"],
//         bump
//     )]
//     pub house_treasury: Account<'info, HouseTreasury>,
//     #[account(mut)]
//     pub authority: Signer<'info>,
//     pub system_program: Program<'info, System>,
// }

// #[derive(Accounts)]
// pub struct FundTreasury<'info> {
//     #[account(mut)]
//     pub funder: Signer<'info>,
//     #[account(
//         mut,
//         seeds = [b"house_treasury"],
//         bump
//     )]
//     pub house_treasury: Account<'info, HouseTreasury>,
//     pub system_program: Program<'info, System>,
// }

// #[derive(Accounts)]
// #[instruction(room_id: String, amount: u64)]
// pub struct CreateCoinflip<'info> {
//     #[account(mut)]
//     pub player: Signer<'info>,

//     #[account(
//         init,
//         payer = player,
//         space = 8 + std::mem::size_of::<Coinflip>(),
//         seeds = [b"coinflip", room_id.as_bytes()],
//         bump
//     )]
//     pub coinflip: Account<'info, Coinflip>,

//     #[account(mut)]
//     pub house_treasury: Account<'info, HouseTreasury>,

//     pub system_program: Program<'info, System>,
// }

// #[derive(Accounts)]
// #[instruction(room_id: String, force: [u8; 32])]
// pub struct PlayCoinflip<'info> {
//     #[account(mut)]
//     pub player: Signer<'info>,

//     #[account(
//         mut, 
//         seeds = [b"coinflip", room_id.as_bytes()],
//         constraint = coinflip.player == player.key(),
//         bump
//     )] 
//     pub coinflip: Account<'info, Coinflip>,

//     #[account(mut)]
//     pub house_treasury: Account<'info, HouseTreasury>,
    
//     #[account(
//         init_if_needed,
//         payer = player,
//         space = 8 + 32 + 1,
//         seeds = [b"mock_vrf", room_id.as_bytes()],
//         bump
//     )]
//     pub random: Account<'info, MockVrfAccount>,

//     pub system_program: Program<'info, System>,
// }

// #[derive(Accounts)]
// #[instruction(room_id: String, force: [u8; 32])]
// pub struct ResultCoinflip<'info> {
//     #[account(mut)]
//     pub player: AccountInfo<'info>,

//     #[account(
//         mut, 
//         seeds = [b"coinflip", room_id.as_bytes()],
//         constraint = coinflip.status == Status::Processing && coinflip.player == player.key(),
//         bump
//     )] 
//     pub coinflip: Account<'info, Coinflip>,

//     #[account(mut)]
//     pub house_treasury: Account<'info, HouseTreasury>,

//     #[account(
//         mut,
//         seeds = [b"mock_vrf", room_id.as_bytes()],
//         bump
//     )]
//     pub random: Account<'info, MockVrfAccount>,

//     pub system_program: Program<'info, System>,
// }

// #[derive(Accounts)]
// pub struct WithdrawHouseFunds<'info> {
//     #[account(mut)]
//     pub authority: Signer<'info>,

//     #[account(
//         mut,
//         seeds = [b"house_treasury"],
//         bump,
//         constraint = house_treasury.authority == authority.key()
//     )]
//     pub house_treasury: Account<'info, HouseTreasury>,

//     pub system_program: Program<'info, System>,
// }