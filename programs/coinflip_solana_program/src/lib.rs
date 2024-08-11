use anchor_lang::prelude::*;
use solana_program::native_token::LAMPORTS_PER_SOL;
use solana_program::system_instruction;
mod misc;
mod pda;
use crate::pda::*;

declare_id!("EjTqfwzMe3QcbAk538ubFSrtDqMxGsjk3ezoJqGTgU4h");

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
        let ix = system_instruction::transfer(
            &ctx.accounts.funder.key(),
            &ctx.accounts.house_treasury.key(),
            amount,
        );

        let account_infos = [
            ctx.accounts.funder.to_account_info().clone(),
            ctx.accounts.house_treasury.to_account_info().clone(),
            ctx.accounts.system_program.to_account_info().clone(),
        ];

        solana_program::program::invoke(&ix, &account_infos)?;

        ctx.accounts.house_treasury.balance += amount;

        Ok(())
    }

    pub fn create_coinflip(
        ctx: Context<CreateCoinflip>,
        room_id: String,
        amount: u64,
        player_choice: PlayerChoice,
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

        ctx.accounts.house_treasury.balance += amount;

        let coinflip = &mut ctx.accounts.coinflip;
        coinflip.player = ctx.accounts.player.key();
        coinflip.amount = amount;
        coinflip.player_choice = player_choice;
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
        let house = &mut ctx.accounts.house_treasury;
        let rand_acc = crate::misc::get_account_data(&ctx.accounts.random)?;

        let randomness = current_state(&rand_acc);
        if randomness == 0 {
            return err!(StillProcessing::StillProcessing);
        }

        let result_bytes = randomness.to_le_bytes();
        let result = u64::from_le_bytes(result_bytes) % 100;

        let game_result = if result < 5 {
            GameResult::Tie
        } else if result < 52 {
            GameResult::Option1Wins
        } else {
            GameResult::Option2Wins
        };

        msg!("VRF result is: {}", result);

        let payout = match (game_result, &coinflip.player_choice) {
            (GameResult::Tie, _) => {
                **house.to_account_info().try_borrow_mut_lamports()? -= coinflip.amount;
                **ctx.accounts.player.try_borrow_mut_lamports()? += coinflip.amount;
                msg!("It's a tie");
                0
            }
            (GameResult::Option1Wins, PlayerChoice::Option1)
            | (GameResult::Option2Wins, PlayerChoice::Option2) => {
                let win_amount = coinflip.amount * 2;
                **house.to_account_info().try_borrow_mut_lamports()? -= win_amount;
                **ctx.accounts.player.try_borrow_mut_lamports()? += win_amount;
                msg!("Player wins: {}", coinflip.player.to_string());
                win_amount
            }
            _ => {
                msg!("House wins");
                coinflip.amount
            }
        };

        house.balance -= payout;

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
