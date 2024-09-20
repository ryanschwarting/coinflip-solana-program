# Solana Coinflip Game

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Smart Contract Overview](#smart-contract-overview)
  - [State Structures](#state-structures)
  - [Main Functions](#main-functions)
  - [Game Logic](#game-logic)
- [Detailed Contract Explanation](#detailed-contract-explanation)
- [Test Logs to Terminal](#test-logs-to-terminal)
- [Connecting to a Frontend](#connecting-to-a-frontend)
  - [Setting up web3.js](#setting-up-web3js)
  - [Interacting with the Contract](#interacting-with-the-contract)
- [Contributing](#contributing)
- [License](#license)

## Introduction

This project implements a decentralized coinflip game on the Solana blockchain. It leverages the Anchor framework for Solana development and integrates with ORAO's Verifiable Random Function (VRF) to ensure fair and provably random outcomes.

The game allows players to bet SOL on a coinflip, with the house acting as the counterparty. The program manages game creation, gameplay, result determination, and payouts.

## Features

- Decentralized coinflip game on Solana
- Integration with ORAO VRF for provably fair randomness
- House treasury management
- Configurable bet limits
- Pausing mechanism for maintenance or emergencies
- Rate limiting to prevent spam
- Withdrawal functionality for house funds

## Prerequisites

- Rust and Cargo (latest stable version)
- Solana CLI tools (v1.14.0 or later)
- Anchor framework (v0.26.0 or later)
- Node.js (v14 or later) and npm
- Git

## Smart Contract Overview

### State Structures

```rust
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

#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PlayerChoice {
    Option1,
    Option2,
    Tie,
}

#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum GameResult {
    Option1Wins,
    Option2Wins,
    Tie
}

#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum Status {
    Waiting,
    Processing,
    Finished
}
```

### Main Functions

1. `initialize_house`: Initializes the house treasury.
2. `fund_treasury`: Allows funding the house treasury.
3. `create_and_play_coinflip`: Creates a new coinflip game and initiates gameplay.
4. `finalize_game`: Determines the game result and updates the game status.
5. `claim_rewards`: Allows the player to claim their rewards if they won.
6. `toggle_pause`: Pauses or unpauses the game contract.
7. `withdraw_house_funds`: Allows the house to withdraw funds.

### Game Logic

The game uses ORAO VRF to generate a random number between 0 and 199:

- 0-9 (5% chance): Tie
- 10-104 (47.5% chance): Option1 wins
- 105-199 (47.5% chance): Option2 wins

## Detailed Contract Explanation

### HouseTreasury

The `HouseTreasury` structure manages the house's funds and control settings:

- `authority`: The public key of the account authorized to manage the treasury.
- `balance`: The current balance of the treasury in lamports.
- `paused`: A boolean flag indicating whether the game is paused.

### Coinflip

The `Coinflip` structure represents an individual game:

- `player`: The public key of the player.
- `amount`: The bet amount in lamports.
- `player_choice`: The player's choice (Option1 or Option2).
- `force`: A 32-byte array used for randomness generation.
- `result`: The game result (Option1Wins, Option2Wins, or Tie).
- `status`: The current status of the game (Waiting, Processing, or Finished).
- `last_play_time`: Timestamp of the last play, used for rate limiting.

### Key Functions

#### initialize_house

```rust
pub fn initialize_house(ctx: Context<InitializeHouse>) -> Result<()> {
    let house = &mut ctx.accounts.house_treasury;
    house.authority = ctx.accounts.authority.key();
    house.balance = 0;
    house.paused = false;
    Ok(())
}
```

This function initializes the house treasury with zero balance and sets it as not paused.

#### create_and_play_coinflip

```rust
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

    // ... (rate limiting check)

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

    // ... (update house treasury and coinflip state)

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

    // ... (update game state)

    Ok(())
}
```

This function creates a new coinflip game, validates the input, transfers the bet amount to the house treasury, and immediately initiates the gameplay by requesting randomness from the ORAO VRF.

#### finalize_game

```rust
pub fn finalize_game(ctx: Context<FinalizeGame>, room_id: String) -> Result<()> {
    // ... (validations and randomness retrieval)

    let game_result = if result < 10 {
        // 0-9 (5% chance)
        GameResult::Tie
    } else if result < 105 {
        // 10-104 (47.5% chance)
        GameResult::Option1Wins
    } else {
        // 105-199 (47.5% chance)
        GameResult::Option2Wins
    };

    // ... (update game state)

    msg!(
        "Coinflip game in room {} has concluded with result {:?}",
        room_id,
        game_result
    );
    coinflip.result = Some(game_result);
    coinflip.status = Status::Finished;

    Ok(())
}
```

This function determines the game result based on the received randomness and updates the game status to "Finished".

#### claim_rewards

```rust
pub fn claim_rewards(ctx: Context<ClaimRewards>, room_id: String) -> Result<()> {
    let coinflip = &ctx.accounts.coinflip;
    let house = &mut ctx.accounts.house_treasury;

    let player_won = match (coinflip.result.unwrap(), &coinflip.player_choice) {
        (GameResult::Option1Wins, PlayerChoice::Option1) => true,
        (GameResult::Option2Wins, PlayerChoice::Option2) => true,
        _ => false,
    };

    require!(player_won, GameError::PlayerDidNotWin);

    let payout = coinflip.amount
        .checked_mul(2)
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
```

This function allows the player to claim their rewards if they won.

## Test Suite

The test suite (`coinflip_solana_program.ts`) includes the following main tests:

1. "Create and play coinflip game": Tests the creation and initiation of a new game.
2. "Wait for randomness fulfillment": Waits for the Orao VRF to fulfill the randomness request.
3. "Get the result": Retrieves and processes the game result.

Additional tests for initializing the house treasury, funding the treasury, toggling the pause state, and withdrawing funds are included but commented out in the current version.

## Game Flow for Frontend Developers

The Solana Coinflip Game follows a three-transaction flow to ensure fairness and proper randomness. Here's a breakdown of the process:

1. Create and Play Coinflip Game (1st Transaction):

   - Player initiates this transaction
   - Specifies: room ID, bet amount, and choice (Option1, Option2, or Tie)
   - Program checks bet limits and house fund sufficiency
   - Transfers bet from player to house treasury
   - Requests randomness from Orao VRF
   - Creates game with "Processing" status

   ```rust
   pub fn create_and_play_coinflip(
       ctx: Context<CreateAndPlayCoinflip>,
       room_id: String,
       amount: u64,
       player_choice: PlayerChoice,
       force: [u8; 32],
   ) -> Result<()> {
       // ... (checks and validations)
       // Transfer bet amount from player to house treasury
       // Initialize coinflip account
       // Request randomness from Orao VRF
       Ok(())
   }
   ```

2. Finalize Game (2nd Transaction):

   - Can be called by anyone, not just the player
   - Checks if Orao VRF randomness is available
   - If available, calculates and stores the game result
   - Updates game status to "Finished"

   ```rust
   pub fn finalize_game(ctx: Context<FinalizeGame>, room_id: String) -> Result<()> {
       // Check if randomness is available
       // Calculate game result
       // Update game status to Finished
       Ok(())
   }
   ```

3. Claim Rewards (3rd Transaction, only for winners):

   - Should only be called by the player if they've won (Option1 or Option2 bet matches the result)
   - Checks if the game is finished and if the player has won
   - If the player won, calculates and transfers the payout (2x bet) from house treasury to player
   - If the player lost or the result was a Tie, this transaction will fail

   ```rust
   pub fn claim_rewards(ctx: Context<ClaimRewards>, room_id: String) -> Result<()> {
       // Check if player won
       // Calculate payout (2x bet)
       // Transfer payout from house treasury to player
       Ok(())
   }
   ```

Important Considerations:

- The frontend should only prompt winners to claim rewards.
- Players who lost or tied do not need to perform this transaction.
- This structure provides a house edge through the Tie result, ensuring long-term sustainability for the game.

Estimated Timings:

- 1st Transaction (create and play): 1-2 seconds
- Waiting for VRF (if manual): 5-10 seconds
- 2nd Transaction (finalize): 1-2 seconds
- 3rd Transaction (claim rewards, if won): 1-2 seconds

Total estimated time: 8-16 seconds (can be reduced to 2-4 seconds with automated finalization)

Frontend Implementation Tips:

1. After the first transaction, show a "waiting for result" screen.
2. If using manual finalization, prompt the user to finalize after 5-10 seconds.
3. After finalization, check the game result and only show the "Claim Rewards" button if the player won.
4. Provide clear feedback at each step of the process.
5. Consider implementing a backend service for automatic finalization to streamline the user experience.

Game Logic:
The game uses Orao VRF to generate a random number between 0 and 199:

- 0-9 (5% chance): Tie
- 10-104 (47.5% chance): Option1 wins
- 105-199 (47.5% chance): Option2 wins

This logic ensures fair and provably random outcomes for each game.

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a new branch: `git checkout -b feature-branch-name`
3. Make your changes and commit them: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature-branch-name`
5. Submit a pull request

## License

This project is licensed under the [MIT License](LICENSE).
