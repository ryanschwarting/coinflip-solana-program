use anchor_lang::prelude::*;
use solana_program::native_token::LAMPORTS_PER_SOL;
use solana_program::system_instruction;
mod misc;
mod pda;
use crate::pda::*;

declare_id!("WmoVEM2PEGyBSDN96UyXgchHdqysPA3KPdEGVaP3D4Z");

pub const MIN_BET: u64 = 5 * LAMPORTS_PER_SOL / 100; // 0.05 SOL
pub const MAX_BET: u64 = 10 * LAMPORTS_PER_SOL; // 10 SOL

#[program]
pub mod solana_coinflip_game {
    use self::misc::current_state;
    use super::*;
    use solana_program::{
        program::invoke,
        system_instruction::{self, transfer},
    };

    pub fn initialize_house(ctx: Context<InitializeHouse>) -> Result<()> {
        let house = &mut ctx.accounts.house_treasury;
        house.authority = ctx.accounts.authority.key();
        house.balance = 0;
        Ok(())
    }

    pub fn fund_treasury(ctx: Context<FundTreasury>, amount: u64) -> Result<()> {
        // Create the transfer instruction
        let ix = system_instruction::transfer(
            &ctx.accounts.funder.key(),
            &ctx.accounts.house_treasury.key(),
            amount,
        );

        // Create the account infos
        let account_infos = [
            ctx.accounts.funder.to_account_info().clone(),
            ctx.accounts.house_treasury.to_account_info().clone(),
            ctx.accounts.system_program.to_account_info().clone(),
        ];

        // Send the instruction
        solana_program::program::invoke(&ix, &account_infos)?;

        // Update the balance in the HouseTreasury account
        ctx.accounts.house_treasury.balance += amount;

        Ok(())
    }

    pub fn create_coinflip(
        ctx: Context<CreateCoinflip>,
        room_id: String,
        amount: u64,
    ) -> Result<()> {
        if amount < MIN_BET {
            return err!(InvalidAmount::TooLow);
        }
        if amount > MAX_BET {
            return err!(InvalidAmount::TooHigh);
        }

        let house_balance = ctx.accounts.house_treasury.balance;
        if house_balance < amount * 2 {
            return err!(HouseError::InsufficientFunds);
        }

        // Transfer bet amount from player to house treasury
        let ix = solana_program::system_instruction::transfer(
            &ctx.accounts.player.key(),
            &ctx.accounts.house_treasury.key(),
            amount,
        );
        solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.player.to_account_info(),
                ctx.accounts.house_treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // Update house balance
        ctx.accounts.house_treasury.balance += amount;

        // Initialize coinflip game
        let coinflip = &mut ctx.accounts.coinflip;
        coinflip.player = ctx.accounts.player.key();
        coinflip.amount = amount;
        coinflip.status = Status::Waiting;

        Ok(())
    }

    pub fn play_coinflip(
        ctx: Context<PlayCoinflip>,
        room_id: String,
        force: [u8; 32],
    ) -> Result<()> {
        let room = &mut ctx.accounts.coinflip;

        msg!("Room {} game started", room_id);

        let cpi_program = ctx.accounts.vrf.to_account_info();
        let cpi_accounts = orao_solana_vrf::cpi::accounts::Request {
            payer: ctx.accounts.player.to_account_info(),
            network_state: ctx.accounts.config.to_account_info(),
            treasury: ctx.accounts.orao_treasury.to_account_info(),
            request: ctx.accounts.random.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        orao_solana_vrf::cpi::request(cpi_ctx, force)?;

        room.force = [0u8; 200];
        room.force[..32].copy_from_slice(&force);
        room.status = Status::Processing;
        msg!("Started game in room {}", room_id);
        Ok(())
    }

    pub fn result_coinflip(
        ctx: Context<ResultCoinflip>,
        room_id: String,
        force: [u8; 200],
    ) -> Result<()> {
        let coinflip = &mut ctx.accounts.coinflip;
        let house = &mut ctx.accounts.house_treasury;
        let rand_acc = crate::misc::get_account_data(&ctx.accounts.random)?;

        let randomness = current_state(&rand_acc);
        if randomness == 0 {
            return err!(StillProcessing::StillProcessing);
        }

        let result = randomness % 200;
        let game_result = if result < 10 {
            GameResult::Tie
        } else if result < 105 {
            GameResult::PlayerWin
        } else {
            GameResult::HouseWin
        };

        msg!("VRF result is: {}", randomness);

        match game_result {
            GameResult::PlayerWin => {
                let payout = coinflip.amount * 2;
                **ctx.accounts.player.lamports.borrow_mut() += payout;
                house.balance -= payout;
                msg!("Player wins: {}", coinflip.player.to_string());
            }
            GameResult::HouseWin => {
                msg!("House wins");
            }
            GameResult::Tie => {
                **ctx.accounts.player.lamports.borrow_mut() += coinflip.amount;
                house.balance -= coinflip.amount;
                msg!("It's a tie");
            }
        }

        msg!(
            "Coinflip game in room {} has concluded with result {:?}",
            room_id,
            game_result
        );
        coinflip.result = Some(game_result);
        coinflip.status = Status::Finished;

        Ok(())
    }

    pub fn withdraw_house_funds(ctx: Context<WithdrawHouseFunds>, amount: u64) -> Result<()> {
        // First, check the balance without mutable borrow
        if amount > ctx.accounts.house_treasury.balance {
            return err!(HouseError::InsufficientFunds);
        }

        // Perform the transfer
        let from_info = ctx.accounts.house_treasury.to_account_info();
        let to_info = ctx.accounts.authority.to_account_info();

        **from_info.try_borrow_mut_lamports()? -= amount;
        **to_info.try_borrow_mut_lamports()? += amount;

        // Now update the balance
        ctx.accounts.house_treasury.balance -= amount;

        Ok(())
    }
}

#[error_code]
pub enum StillProcessing {
    #[msg("Randomness is still being fulfilled")]
    StillProcessing,
}

#[error_code]
pub enum InvalidAmount {
    #[msg("Amount must be at least 0.05 SOL")]
    TooLow,
    #[msg("Amount must not exceed 10 SOL")]
    TooHigh,
}

#[error_code]
pub enum HouseError {
    #[msg("Not enough house funds for payout")]
    InsufficientFunds,
}

// use anchor_lang::prelude::*;
// use solana_program::native_token::LAMPORTS_PER_SOL;
// mod misc;
// mod pda;
// use crate::pda::*;

// declare_id!("J2Kisr9DAKQvYZ7nYF2q5RWS2qBNXXQtszM8NtSHaDYk");

// pub const MIN_BET: u64 = 5 * LAMPORTS_PER_SOL / 100; // 0.05 SOL
// pub const MAX_BET: u64 = 10 * LAMPORTS_PER_SOL; // 10 SOL

// #[program]
// pub mod solana_coinflip_game {
//     use super::*;
//     use solana_program::system_instruction;

//     pub fn initialize_house(ctx: Context<InitializeHouse>) -> Result<()> {
//         let house = &mut ctx.accounts.house_treasury;
//         house.authority = ctx.accounts.authority.key();
//         house.balance = 0;
//         Ok(())
//     }

//     pub fn fund_treasury(ctx: Context<FundTreasury>, amount: u64) -> Result<()> {
//         let ix = system_instruction::transfer(
//             &ctx.accounts.funder.key(),
//             &ctx.accounts.house_treasury.key(),
//             amount,
//         );

//         solana_program::program::invoke(
//             &ix,
//             &[
//                 ctx.accounts.funder.to_account_info(),
//                 ctx.accounts.house_treasury.to_account_info(),
//                 ctx.accounts.system_program.to_account_info(),
//             ],
//         )?;

//         ctx.accounts.house_treasury.balance += amount;
//         Ok(())
//     }

//     pub fn create_coinflip(
//         ctx: Context<CreateCoinflip>,
//         room_id: String,
//         amount: u64,
//     ) -> Result<()> {
//         if amount < MIN_BET || amount > MAX_BET {
//             return err!(InvalidAmount::InvalidAmount);
//         }

//         let house_balance = ctx.accounts.house_treasury.balance;
//         if house_balance < amount * 2 {
//             return err!(HouseError::InsufficientFunds);
//         }

//         let ix = system_instruction::transfer(
//             &ctx.accounts.player.key(),
//             &ctx.accounts.house_treasury.key(),
//             amount,
//         );
//         solana_program::program::invoke(
//             &ix,
//             &[
//                 ctx.accounts.player.to_account_info(),
//                 ctx.accounts.house_treasury.to_account_info(),
//                 ctx.accounts.system_program.to_account_info(),
//             ],
//         )?;

//         ctx.accounts.house_treasury.balance += amount;

//         let coinflip = &mut ctx.accounts.coinflip;
//         coinflip.player = ctx.accounts.player.key();
//         coinflip.amount = amount;
//         coinflip.status = Status::Waiting;

//         Ok(())
//     }

//     pub fn play_coinflip(
//         ctx: Context<PlayCoinflip>,
//         room_id: String,
//         force: [u8; 32],
//     ) -> Result<()> {
//         let room = &mut ctx.accounts.coinflip;
//         room.status = Status::Processing;

//         // Mock VRF request
//         ctx.accounts.random.randomness = Some([0u8; 32]);
//         ctx.accounts.random.is_fulfilled = false;

//         room.force = force;
//         msg!("Started game in room {}", room_id);
//         Ok(())
//     }

//     pub fn result_coinflip(
//         ctx: Context<ResultCoinflip>,
//         room_id: String,
//         force: [u8; 32],
//     ) -> Result<()> {
//         let coinflip = &mut ctx.accounts.coinflip;
//         let house = &mut ctx.accounts.house_treasury;

//         // Mock VRF fulfillment
//         if !ctx.accounts.random.is_fulfilled {
//             return err!(StillProcessing::StillProcessing);
//         }

//         let randomness = u64::from_le_bytes(
//             ctx.accounts.random.randomness.unwrap()[0..8]
//                 .try_into()
//                 .unwrap(),
//         );
//         msg!("VRF result is: {}", randomness);

//         let result = randomness % 200;
//         let game_result = if result < 10 {
//             GameResult::Tie
//         } else if result < 105 {
//             GameResult::PlayerWin
//         } else {
//             GameResult::HouseWin
//         };

//         match game_result {
//             GameResult::PlayerWin => {
//                 let payout = coinflip.amount * 2;
//                 **ctx.accounts.player.lamports.borrow_mut() += payout;
//                 house.balance -= payout;
//                 msg!("Player wins: {}", coinflip.player.to_string());
//             }
//             GameResult::HouseWin => {
//                 msg!("House wins");
//             }
//             GameResult::Tie => {
//                 **ctx.accounts.player.lamports.borrow_mut() += coinflip.amount;
//                 house.balance -= coinflip.amount;
//                 msg!("It's a tie");
//             }
//         }

//         coinflip.result = Some(game_result);
//         coinflip.status = Status::Finished;

//         Ok(())
//     }

//     pub fn withdraw_house_funds(ctx: Context<WithdrawHouseFunds>, amount: u64) -> Result<()> {
//         let house = &mut ctx.accounts.house_treasury;
//         if amount > house.balance {
//             return err!(HouseError::InsufficientFunds);
//         }

//         **ctx.accounts.authority.lamports.borrow_mut() += amount;
//         **ctx
//             .accounts
//             .house_treasury
//             .to_account_info()
//             .try_borrow_mut_lamports()? -= amount;
//         house.balance -= amount;

//         Ok(())
//     }
// }

// #[error_code]
// pub enum InvalidAmount {
//     #[msg("Invalid bet amount")]
//     InvalidAmount,
// }

// #[error_code]
// pub enum HouseError {
//     #[msg("Not enough house funds for payout")]
//     InsufficientFunds,
// }

// #[error_code]
// pub enum StillProcessing {
//     #[msg("Randomness is still being fulfilled")]
//     StillProcessing,
// }
