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

The game allows players to bet SOL on a coinflip, with the house acting as the counterparty. The smart contract manages game creation, gameplay, result determination, and payouts.

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
3. `create_coinflip`: Creates a new coinflip game.
4. `play_coinflip`: Initiates the gameplay and requests randomness.
5. `result_coinflip`: Determines the game result and handles payouts.
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

#### create_coinflip

```rust
pub fn create_coinflip(
    ctx: Context<CreateCoinflip>,
    room_id: String,
    amount: u64,
    player_choice: PlayerChoice,
) -> Result<()> {
    // ... (input validation)

    let coinflip = &mut ctx.accounts.coinflip;
    coinflip.player = ctx.accounts.player.key();
    coinflip.amount = amount;
    coinflip.player_choice = player_choice;
    coinflip.status = Status::Waiting;
    coinflip.last_play_time = ctx.accounts.clock.unix_timestamp;

    // ... (transfer funds to house treasury)

    Ok(())
}
```

This function creates a new coinflip game, validating the input and transferring the bet amount to the house treasury.

#### play_coinflip

```rust
pub fn play_coinflip(
    ctx: Context<PlayCoinflip>,
    room_id: String,
    force: [u8; 32],
) -> Result<()> {
    let room = &mut ctx.accounts.coinflip;
    room.force = force;
    room.status = Status::Processing;

    // ... (request randomness from ORAO VRF)

    Ok(())
}
```

This function initiates the gameplay by requesting randomness from the ORAO VRF.

#### result_coinflip

```rust
pub fn result_coinflip(
    ctx: Context<ResultCoinflip>,
    room_id: String,
    force: [u8; 32],
) -> Result<()> {
    // ... (retrieve randomness and determine result)

    let payout = match (game_result, &coinflip.player_choice) {
        (GameResult::Tie, _) => coinflip.amount,
        (GameResult::Option1Wins, PlayerChoice::Option1) |
        (GameResult::Option2Wins, PlayerChoice::Option2) => coinflip.amount * 2,
        _ => 0,
    };

    // ... (handle payout)

    coinflip.result = Some(game_result);
    coinflip.status = Status::Finished;

    Ok(())
}
```

This function determines the game result based on the received randomness and handles the payout accordingly.

### Test Logs to Terminal

```shell
🎲 Starting Solana Coinflip Game Test Suite 🎲

👤 Player's Public Key: AWFkiMVNxaky86PyeRuQcrkFs5ErH7chsbmvbPpTRGAc
🏠 Generated Room ID: 8bbs5BdS
💰 Bet Amount: 0.1 SOL
🎰 Coinflip Game Address: 6hfrfB87x5QmN8A6KRzBbhESzGWbERsu9zV8KWcGZA6h
🏦 House Treasury Address: HF58NX1G9Yeump2AVH3KqApcar7yLpgoZBPtS4MxFfLc
🌐 Network State Address: 5ER1oENnV4srxYdAynUfRzWeQCPQaqMiAp4VqyMbSqnK
💼 ORAO Treasury Address: 9ZTHWWZDpB36UFe1vszf2KEpt83vwi27jDqtHQ7NSXyR

🔮 Generated Force Public Key: 4jwccKFJzmutWWeo8pe1MTRkGmvX3dKVm1x4Zq98ac9Z

## Create Coinflip Game Test

🎬 Starting: Create Coinflip Game Test
👤 Initial Player Balance: 22.94844116 SOL
🏦 Initial House Treasury Balance: 1.22061596 SOL
🎲 Player's Choice: Option 1
✅ Coinflip game created successfully!
📜 Transaction Signature: dHrR9trGAfyXBSAhgsKiAHUiveFVKoQqwRyJ6ruYRXA7KQKzrw67rQ2pZgAfGbKNbQUg3CqXsQmh3zrb4v3RWdC

📊 Game Data After Creation:
Player: AWFkiMVNxaky86PyeRuQcrkFs5ErH7chsbmvbPpTRGAc
Bet Amount: 0.1 SOL
Player Choice: {"option1":{}}
Game Status: {"waiting":{}}

✔ Create coinflip game (1605ms)

### Play the Game Test

🎮 Starting: Play the Game Test
🔮 New Force Public Key: ERjbtH2eoe6hbZF1jRNWhR22BwMT4T7RQ3yPgUVU7d1z
🎲 Random Account Address: 22DiBGoAMDWjpymqXysLbtsBB2ajoj66i2J7srXcX38K
✅ Game has started successfully!
📜 Transaction Signature: 2eodrSxGoDPt8q1RLGe8A4fS9deddqVCuVu5a2u41R93cmZfk2pVqA8nCujM3DZHEs6bXAYeB4jTyC2EHwVo2Cse

📊 Game State After Play:
Player: AWFkiMVNxaky86PyeRuQcrkFs5ErH7chsbmvbPpTRGAc
Bet Amount: 0.1 SOL
Player Choice: {"option1":{}}
Game Status: {"processing":{}}

✅ Assertion passed: Game status is 'processing'
✔ Play the game (828ms)

### Wait for Randomness Fulfillment Test

⏳ Starting: Wait for Randomness Fulfillment Test
Waiting for ORAO VRF to fulfill the randomness request...
✅ Randomness has been fulfilled by ORAO VRF
We can now proceed to get the game result
✔ Wait for randomness fulfillment (2387ms)

### Get the Game Result Test

🏁 Starting: Get the Game Result Test
🎲 Random Account Address: 22DiBGoAMDWjpymqXysLbtsBB2ajoj66i2J7srXcX38K
✅ Game result has been processed successfully!
📜 Transaction Signature: mQAs6BgMNNzkqQgSTqHY5XEcdqr4bRiYdZzY165EJBM9WUMFxG5fuEGoBMMyVaZiJpK1QXQafGa1dosvvh8KtX9

📊 Final Game Result:
Player: AWFkiMVNxaky86PyeRuQcrkFs5ErH7chsbmvbPpTRGAc
Bet Amount: 0.1 SOL
Player Choice: {"option1":{}}
Game Status: {"finished":{}}
Winner: {"option2Wins":{}}

💰 Final Balances:
Player balance: 22.83954744 SOL
House Treasury balance: 1.32061596 SOL

📈 Balance Changes:
Player: -0.1089 SOL
House Treasury: +0.1000 SOL

✔ Get the result (1721ms)
```

## Connecting to a Frontend

### Setting up web3.js

1. Install required dependencies:

```bash
 npm install @solana/web3.js @project-serum/anchor
```

2. Set up a connection to the Solana network:

   ```javascript
   import { Connection, clusterApiUrl } from "@solana/web3.js";
   import { Program, Provider, web3 } from "@project-serum/anchor";
   import { SolanaCoinflipGame } from "./idl/solana_coinflip_game";

   const network = clusterApiUrl("devnet");
   const opts = {
     preflightCommitment: "processed",
   };

   const connection = new Connection(network, opts.preflightCommitment);

   const getProvider = async () => {
     const provider = new Provider(
       connection,
       window.solana,
       opts.preflightCommitment
     );
     return provider;
   };
   ```

### Interacting with the Contract

Here are some examples of how to interact with the contract using web3.js:

1. Initialize the program:

   ```javascript
   const provider = await getProvider();
   const programId = new web3.PublicKey("YOUR_PROGRAM_ID");
   const program = new Program(SolanaCoinflipGame, programId, provider);
   ```

2. Create a coinflip game:

   ```javascript
   const createCoinflip = async (amount, playerChoice) => {
     const roomId = Math.random().toString(36).substring(7);
     const [coinflipPDA] = await web3.PublicKey.findProgramAddress(
       [Buffer.from("coinflip"), Buffer.from(roomId)],
       program.programId
     );
     const [houseTreasuryPDA] = await web3.PublicKey.findProgramAddress(
       [Buffer.from("house_treasury")],
       program.programId
     );

     await program.rpc.createCoinflip(
       roomId,
       new BN(amount),
       { [playerChoice.toLowerCase()]: {} },
       {
         accounts: {
           player: provider.wallet.publicKey,
           coinflip: coinflipPDA,
           houseTreasury: houseTreasuryPDA,
           systemProgram: web3.SystemProgram.programId,
         },
       }
     );

     return roomId;
   };
   ```

3. Play the game:

   ```javascript
   const playCoinflip = async (roomId) => {
     const [coinflipPDA] = await web3.PublicKey.findProgramAddress(
       [Buffer.from("coinflip"), Buffer.from(roomId)],
       program.programId
     );
     const [houseTreasuryPDA] = await web3.PublicKey.findProgramAddress(
       [Buffer.from("house_treasury")],
       program.programId
     );
     const force = web3.Keypair.generate().publicKey;
     const randomPDA = await orao.randomnessAccountAddress(force.toBuffer());

     await program.rpc.playCoinflip(roomId, Array.from(force.toBuffer()), {
       accounts: {
         player: provider.wallet.publicKey,
         coinflip: coinflipPDA,
         houseTreasury: houseTreasuryPDA,
         oraoTreasury: new web3.PublicKey(
           "9ZTHWWZDpB36UFe1vszf2KEpt83vwi27jDqtHQ7NSXyR"
         ),
         vrf: orao.programId,
         config: orao.networkStateAccountAddress(),
         random: randomPDA,
         systemProgram: web3.SystemProgram.programId,
       },
     });

     return force;
   };
   ```

4. Get the result:

   ```javascript
   const getResult = async (roomId, force) => {
     const [coinflipPDA] = await web3.PublicKey.findProgramAddress(
       [Buffer.from("coinflip"), Buffer.from(roomId)],
       program.programId
     );
     const [houseTreasuryPDA] = await web3.PublicKey.findProgramAddress(
       [Buffer.from("house_treasury")],
       program.programId
     );
     const randomPDA = await orao.randomnessAccountAddress(force.toBuffer());

     await program.rpc.resultCoinflip(roomId, Array.from(force.toBuffer()), {
       accounts: {
         player: provider.wallet.publicKey,
         coinflip: coinflipPDA,
         houseTreasury: houseTreasuryPDA,
         oraoTreasury: new web3.PublicKey(
           "9ZTHWWZDpB36UFe1vszf2KEpt83vwi27jDqtHQ7NSXyR"
         ),
         vrf: orao.programId,
         config: orao.networkStateAccountAddress(),
         random: randomPDA,
         systemProgram: web3.SystemProgram.programId,
       },
     });

     const gameState = await program.account.coinflip.fetch(coinflipPDA);
     return gameState.result;
   };
   ```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a new branch: `git checkout -b feature-branch-name`
3. Make your changes and commit them: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature-branch-name`
5. Submit a pull request

## License

This project is licensed under the [MIT License](LICENSE).

```

```
