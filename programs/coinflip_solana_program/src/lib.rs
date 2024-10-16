use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;
use solana_program::native_token::LAMPORTS_PER_SOL;
use solana_program::system_instruction;
mod misc;
mod pda;
use crate::pda::*;

declare_id!("7e4UjnCCHPUdgA88i6CXjFQAoHfG4ZGjbwVVVaCvcKDt");

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
        house.paused = false; // Initialize as not paused
        Ok(())
    }

    pub fn fund_treasury(ctx: Context<FundTreasury>, amount: u64) -> Result<()> {
        require!(
            !ctx.accounts.house_treasury.paused,
            ProgramError::ProgramPaused
        );
        require!(amount > 0, InvalidAmount::ZeroAmount);

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

        ctx.accounts.house_treasury.balance = ctx
            .accounts
            .house_treasury
            .balance
            .checked_add(amount)
            .ok_or(ProgramError::ArithmeticOverflow)?;

        Ok(())
    }

    pub fn create_and_play_coinflip(
        ctx: Context<CreateAndPlayCoinflip>,
        room_id: String,
        amount: u64,
        player_choice: PlayerChoice,
        force: [u8; 32],
    ) -> Result<()> {
        require!(
            !ctx.accounts.house_treasury.paused,
            ProgramError::ProgramPaused
        );
        require!(amount >= MIN_BET, InvalidAmount::TooLow);
        require!(amount <= MAX_BET, InvalidAmount::TooHigh);
        require!(room_id.len() <= 32, InvalidInput::RoomIdTooLong);

        let house_balance = ctx.accounts.house_treasury.balance;
        let required_balance = match player_choice {
            PlayerChoice::Tie => amount
                .checked_mul(6)
                .ok_or(ProgramError::ArithmeticOverflow)?,
            _ => amount
                .checked_mul(2)
                .ok_or(ProgramError::ArithmeticOverflow)?,
        };

        require!(
            house_balance >= required_balance,
            HouseError::InsufficientFunds
        );

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

        ctx.accounts.house_treasury.balance = ctx
            .accounts
            .house_treasury
            .balance
            .checked_add(amount)
            .ok_or(ProgramError::ArithmeticOverflow)?;

        // Initialize coinflip account
        let coinflip = &mut ctx.accounts.coinflip;
        coinflip.player = ctx.accounts.player.key();
        coinflip.amount = amount;
        coinflip.player_choice = player_choice;
        coinflip.status = Status::Processing;
        coinflip.last_play_time = ctx.accounts.clock.unix_timestamp;

        // Request randomness from Orao VRF
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

        coinflip.force = force;
        msg!("Started game in room {}", room_id);
        Ok(())
    }

    pub fn finalize_game(ctx: Context<FinalizeGame>, room_id: String) -> Result<()> {
        let coinflip = &mut ctx.accounts.coinflip;
        let rand_acc = crate::misc::get_account_data(&ctx.accounts.random)?;

        let randomness = current_state(&rand_acc);
        require!(randomness != 0, StillProcessing::StillProcessing);

        let result_bytes = randomness.to_le_bytes();
        let result = u64::from_le_bytes(result_bytes) % 200;

        let game_result = if result < 10 {
            GameResult::Tie
        } else if result < 105 {
            GameResult::Option1Wins
        } else {
            GameResult::Option2Wins
        };

        coinflip.result = Some(game_result);
        coinflip.status = Status::Finished;

        msg!("Game finalized with result: {:?}", game_result);
        Ok(())
    }

    pub fn claim_rewards(ctx: Context<ClaimRewards>, room_id: String) -> Result<()> {
        let coinflip = &ctx.accounts.coinflip;
        let house = &mut ctx.accounts.house_treasury;

        let player_won = match (coinflip.result.unwrap(), &coinflip.player_choice) {
            (GameResult::Tie, PlayerChoice::Tie) => true,
            (GameResult::Option1Wins, PlayerChoice::Option1) => true,
            (GameResult::Option2Wins, PlayerChoice::Option2) => true,
            _ => false,
        };

        require!(player_won, GameError::PlayerDidNotWin);

        let payout = match coinflip.result.unwrap() {
            GameResult::Tie => coinflip.amount.checked_mul(6),
            _ => coinflip.amount.checked_mul(2),
        }
        .ok_or(ProgramError::ArithmeticOverflow)?;

        // Transfer payout from house treasury to player
        **house.to_account_info().try_borrow_mut_lamports()? = house
            .to_account_info()
            .lamports()
            .checked_sub(payout)
            .ok_or(ProgramError::ArithmeticOverflow)?;
        **ctx.accounts.player.try_borrow_mut_lamports()? = ctx
            .accounts
            .player
            .lamports()
            .checked_add(payout)
            .ok_or(ProgramError::ArithmeticOverflow)?;

        house.balance = house
            .balance
            .checked_sub(payout)
            .ok_or(ProgramError::ArithmeticOverflow)?;

        msg!("Player wins: {} lamports", payout);
        Ok(())
    }

    pub fn toggle_pause(ctx: Context<TogglePause>) -> Result<()> {
        let house = &mut ctx.accounts.house_treasury;
        house.paused = !house.paused;
        msg!("Program paused state toggled to: {}", house.paused);
        Ok(())
    }

    pub fn withdraw_house_funds(ctx: Context<WithdrawHouseFunds>, amount: u64) -> Result<()> {
        let house_treasury = &mut ctx.accounts.house_treasury;
        let authority = &ctx.accounts.authority;

        require!(amount > 0, InvalidAmount::ZeroAmount);
        require!(
            house_treasury.balance >= amount,
            HouseError::InsufficientFunds
        );

        **house_treasury.to_account_info().try_borrow_mut_lamports()? = house_treasury
            .to_account_info()
            .lamports()
            .checked_sub(amount)
            .ok_or(ProgramError::ArithmeticOverflow)?;
        **authority.to_account_info().try_borrow_mut_lamports()? = authority
            .to_account_info()
            .lamports()
            .checked_add(amount)
            .ok_or(ProgramError::ArithmeticOverflow)?;

        house_treasury.balance = house_treasury
            .balance
            .checked_sub(amount)
            .ok_or(ProgramError::ArithmeticOverflow)?;

        msg!("Withdrawn {} lamports from the treasury", amount);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct TogglePause<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"house_treasury"],
        bump,
        constraint = house_treasury.authority == authority.key()
    )]
    pub house_treasury: Account<'info, HouseTreasury>,
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
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
}

#[error_code]
pub enum HouseError {
    #[msg("Not enough house funds for payout")]
    InsufficientFunds,
}

#[error_code]
pub enum ProgramError {
    #[msg("Program is currently paused")]
    ProgramPaused,
    #[msg("Arithmetic overflow occurred")]
    ArithmeticOverflow,
}

#[error_code]
pub enum RateLimitError {
    #[msg("Too many requests. Please wait before trying again")]
    TooManyRequests,
}

#[error_code]
pub enum InvalidInput {
    #[msg("Room ID is too long")]
    RoomIdTooLong,
}

#[error_code]
pub enum GameError {
    #[msg("Player did not win this game")]
    PlayerDidNotWin,
}
