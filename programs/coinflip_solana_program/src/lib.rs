// use anchor_lang::prelude::*;
// use solana_program::native_token::LAMPORTS_PER_SOL;
// mod misc;
// mod pda;
// use crate::pda::*;

// declare_id!("64CRrSCxSoEUDv2Sg3fKrwxotoiyD1bfce1AyCeuF582");

// pub const MIN_BET: u64 = 5 * LAMPORTS_PER_SOL / 100; // 0.05 SOL
// pub const MAX_BET: u64 = 10 * LAMPORTS_PER_SOL; // 10 SOL

// #[program]
// pub mod solana_coinflip_game {
//     use self::misc::current_state;
//     use super::*;
//     use solana_program::{program::invoke, system_instruction::transfer};

//     pub fn create_coinflip(
//         ctx: Context<CreateCoinflip>,
//         room_id: [u8; 32],
//         amount: u64,
//     ) -> Result<()> {
//         if amount < MIN_BET {
//             return err!(InvalidAmount::TooLow);
//         }
//         if amount > MAX_BET {
//             return err!(InvalidAmount::TooHigh);
//         }

//         // Check if the house has enough funds to cover a potential payout
//         let required_house_balance = amount * 2; // The house needs to be able to pay double the bet
//         if ctx.accounts.house_treasury.lamports() < required_house_balance {
//             return err!(HouseError::InsufficientFunds);
//         }

//         let coinflip = &mut ctx.accounts.coinflip;

//         invoke(
//             &transfer(
//                 ctx.accounts.player.to_account_info().key,
//                 coinflip.to_account_info().key,
//                 amount,
//             ),
//             &[
//                 ctx.accounts.player.to_account_info(),
//                 coinflip.to_account_info(),
//                 ctx.accounts.system_program.to_account_info(),
//             ],
//         )?;

//         coinflip.player = ctx.accounts.player.key();
//         coinflip.amount = amount;
//         coinflip.status = Status::Waiting;

//         msg!("Coinflip game is initiated");

//         Ok(())
//     }

//     pub fn play_coinflip(
//         ctx: Context<PlayCoinflip>,
//         room_id: [u8; 32],
//         force: [u8; 32],
//     ) -> Result<()> {
//         let room = &mut ctx.accounts.coinflip;

//         msg!(
//             "Room {} game started",
//             std::str::from_utf8(&room_id).unwrap_or("Invalid UTF-8")
//         );

//         let cpi_program = ctx.accounts.vrf.to_account_info();
//         let cpi_accounts = orao_solana_vrf::cpi::accounts::Request {
//             payer: ctx.accounts.player.to_account_info(),
//             network_state: ctx.accounts.config.to_account_info(),
//             treasury: ctx.accounts.house_treasury.to_account_info(),
//             request: ctx.accounts.random.to_account_info(),
//             system_program: ctx.accounts.system_program.to_account_info(),
//         };
//         let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
//         orao_solana_vrf::cpi::request(cpi_ctx, force)?;

//         room.force = force;
//         room.status = Status::Processing;
//         msg!(
//             "Started game in room {}",
//             std::str::from_utf8(&room_id).unwrap_or("Invalid UTF-8")
//         );
//         Ok(())
//     }

//     pub fn result_coinflip(
//         ctx: Context<ResultCoinflip>,
//         room_id: [u8; 32],
//         force: [u8; 32],
//     ) -> Result<()> {
//         let coinflip = &mut ctx.accounts.coinflip;
//         let rand_acc = crate::misc::get_account_data(&ctx.accounts.random)?;

//         let randomness = current_state(&rand_acc);
//         if randomness == 0 {
//             return err!(StillProcessing::StillProcessing);
//         }

//         let result = randomness % 20;
//         let game_result = if result == 0 {
//             GameResult::Tie
//         } else if result <= 10 {
//             GameResult::PlayerWin
//         } else {
//             GameResult::HouseWin
//         };

//         msg!("VRF result is: {}", randomness);

//         match game_result {
//             GameResult::PlayerWin => {
//                 **ctx.accounts.player.lamports.borrow_mut() = ctx
//                     .accounts
//                     .player
//                     .lamports()
//                     .checked_add(coinflip.amount * 2)
//                     .unwrap();
//                 **ctx.accounts.house_treasury.lamports.borrow_mut() -= coinflip.amount * 2;
//                 msg!("Player wins: {}", coinflip.player.to_string());
//             }
//             GameResult::HouseWin => {
//                 **ctx.accounts.house_treasury.lamports.borrow_mut() = ctx
//                     .accounts
//                     .house_treasury
//                     .lamports()
//                     .checked_add(coinflip.amount)
//                     .unwrap();
//                 msg!("House wins");
//             }
//             GameResult::Tie => {
//                 **ctx.accounts.player.lamports.borrow_mut() = ctx
//                     .accounts
//                     .player
//                     .lamports()
//                     .checked_add(coinflip.amount)
//                     .unwrap();
//                 msg!("It's a tie");
//             }
//         }

//         msg!(
//             "Coinflip game in room {} has concluded with result {:?}",
//             std::str::from_utf8(&room_id).unwrap_or("Invalid UTF-8"),
//             game_result
//         );
//         coinflip.result = Some(game_result);
//         coinflip.status = Status::Finished;

//         Ok(())
//     }
// }

// #[error_code]
// pub enum StillProcessing {
//     #[msg("Randomness is still being fulfilled")]
//     StillProcessing,
// }

// #[error_code]
// pub enum InvalidAmount {
//     #[msg("Amount must be at least 0.05 SOL")]
//     TooLow,
//     #[msg("Amount must not exceed 10 SOL")]
//     TooHigh,
// }

// #[error_code]
// pub enum HouseError {
//     #[msg("Not enough house funds for payout")]
//     InsufficientFunds,
// }

use anchor_lang::prelude::*;
use solana_program::native_token::LAMPORTS_PER_SOL;
mod misc;
mod pda;
use crate::pda::*;

declare_id!("4VqUm2KUR3RVsFCH7NqWmdonoZERf5AoSmKyZzEuo7Sg");

pub const MIN_BET: u64 = 5 * LAMPORTS_PER_SOL / 100; // 0.05 SOL
pub const MAX_BET: u64 = 10 * LAMPORTS_PER_SOL; // 10 SOL

#[program]
pub mod solana_coinflip_game {
    use self::misc::current_state;
    use super::*;
    use solana_program::{program::invoke, system_instruction::transfer};

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

        // Check if the house has enough funds to cover a potential payout
        let required_house_balance = amount * 2; // The house needs to be able to pay double the bet
        if ctx.accounts.house_treasury.lamports() < required_house_balance {
            return err!(HouseError::InsufficientFunds);
        }

        let coinflip = &mut ctx.accounts.coinflip;

        invoke(
            &transfer(
                ctx.accounts.player.to_account_info().key,
                coinflip.to_account_info().key,
                amount,
            ),
            &[
                ctx.accounts.player.to_account_info(),
                coinflip.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        coinflip.player = ctx.accounts.player.key();
        coinflip.amount = amount;
        coinflip.status = Status::Waiting;

        msg!("Coinflip game is initiated");

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
            treasury: ctx.accounts.house_treasury.to_account_info(),
            request: ctx.accounts.random.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        orao_solana_vrf::cpi::request(cpi_ctx, force)?;

        room.force = force;
        room.status = Status::Processing;
        msg!("Started game in room {}", room_id);
        Ok(())
    }

    pub fn result_coinflip(
        ctx: Context<ResultCoinflip>,
        room_id: String,
        force: [u8; 32],
    ) -> Result<()> {
        let coinflip = &mut ctx.accounts.coinflip;
        let rand_acc = crate::misc::get_account_data(&ctx.accounts.random)?;

        let randomness = current_state(&rand_acc);
        if randomness == 0 {
            return err!(StillProcessing::StillProcessing);
        }

        let result = randomness % 20;
        let game_result = if result == 0 {
            GameResult::Tie
        } else if result <= 10 {
            GameResult::PlayerWin
        } else {
            GameResult::HouseWin
        };

        msg!("VRF result is: {}", randomness);

        match game_result {
            GameResult::PlayerWin => {
                **ctx.accounts.player.lamports.borrow_mut() = ctx
                    .accounts
                    .player
                    .lamports()
                    .checked_add(coinflip.amount * 2)
                    .unwrap();
                **ctx.accounts.house_treasury.lamports.borrow_mut() -= coinflip.amount * 2;
                msg!("Player wins: {}", coinflip.player.to_string());
            }
            GameResult::HouseWin => {
                **ctx.accounts.house_treasury.lamports.borrow_mut() = ctx
                    .accounts
                    .house_treasury
                    .lamports()
                    .checked_add(coinflip.amount)
                    .unwrap();
                msg!("House wins");
            }
            GameResult::Tie => {
                **ctx.accounts.player.lamports.borrow_mut() = ctx
                    .accounts
                    .player
                    .lamports()
                    .checked_add(coinflip.amount)
                    .unwrap();
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
