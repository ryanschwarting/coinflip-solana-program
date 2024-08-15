import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SolanaCoinflipGame } from "../target/types/solana_coinflip_game";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { BN } from "@project-serum/anchor";
import {
  networkStateAccountAddress,
  Orao,
  randomnessAccountAddress,
} from "@orao-network/solana-vrf";
import { assert } from "chai";

export type PlayerChoice =
  | {
      option1: {};
    }
  | {
      option2: {};
    };

function randomString(length = 8) {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

describe("solana-coinflip-game", () => {
  console.log("\n🎲 Starting Solana Coinflip Game Test Suite 🎲\n");

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .SolanaCoinflipGame as Program<SolanaCoinflipGame>;
  const player = provider.wallet;

  console.log(`👤 Player's Public Key: ${player.publicKey.toBase58()}`);

  let initialPlayerBalance: BN;
  let initialHouseTreasuryBalance: BN;

  const room_id = randomString();
  console.log(`🏠 Generated Room ID: ${room_id}`);

  const amount = new BN(LAMPORTS_PER_SOL * 0.1);
  console.log(`💰 Bet Amount: ${amount.toNumber() / LAMPORTS_PER_SOL} SOL`);

  const [coinflip] = PublicKey.findProgramAddressSync(
    [Buffer.from("coinflip"), Buffer.from(room_id)],
    program.programId
  );
  console.log(`🎰 Coinflip Game Address: ${coinflip.toBase58()}`);

  const [houseTreasury] = PublicKey.findProgramAddressSync(
    [Buffer.from("house_treasury")],
    program.programId
  );
  console.log(`🏦 House Treasury Address: ${houseTreasury.toBase58()}`);

  const vrf = new Orao(provider as any);
  const networkState = networkStateAccountAddress();
  console.log(`🌐 Network State Address: ${networkState.toBase58()}`);

  let force: PublicKey;
  const oraoTreasury = new PublicKey(
    "9ZTHWWZDpB36UFe1vszf2KEpt83vwi27jDqtHQ7NSXyR"
  );
  console.log(`💼 ORAO Treasury Address: ${oraoTreasury.toBase58()}`);

  before(async () => {
    force = Keypair.generate().publicKey;
    console.log(`🔮 Generated Force Public Key: ${force.toBase58()}`);
  });

  // it("Initialize house treasury", async () => {
  //   try {
  //     const tx = await program.methods
  //       .initializeHouse()
  //       .accounts({
  //         houseTreasury,
  //         authority: player.publicKey,
  //         systemProgram: SystemProgram.programId,
  //       })
  //       .rpc();
  //     console.log("House treasury initialized");
  //   } catch (e) {
  //     console.log("House treasury already initialized or error:", e);
  //   }
  // });

  // it("Fund house treasury", async () => {
  //   try {
  //     const tx = await program.methods
  //       .fundTreasury(new BN(LAMPORTS_PER_SOL * 0.5))
  //       .accounts({
  //         funder: player.publicKey,
  //         houseTreasury,
  //         systemProgram: SystemProgram.programId,
  //       })
  //       .rpc();
  //     console.log("House treasury funded");
  //   } catch (e) {
  //     console.error("Error funding house treasury:", e);
  //     throw e;
  //   }
  // });

  // it("Unpauses the program", async () => {
  //   try {
  //     // Check initial pause state
  //     let houseTreasuryAccount = await program.account.houseTreasury.fetch(
  //       houseTreasury
  //     );
  //     console.log("Initial pause state:", houseTreasuryAccount.paused);

  //     // Toggle pause state
  //     const toggleTx = await program.methods
  //       .togglePause()
  //       .accounts({
  //         authority: player.publicKey,
  //         houseTreasury: houseTreasury,
  //       })
  //       .rpc();
  //     console.log("Toggle transaction:", toggleTx);

  //     // Check final pause state
  //     houseTreasuryAccount = await program.account.houseTreasury.fetch(
  //       houseTreasury
  //     );
  //     console.log("Final pause state:", houseTreasuryAccount.paused);

  //     // Assert that the program is now unpaused
  //     assert.isFalse(houseTreasuryAccount.paused, "Program should be unpaused");
  //   } catch (e) {
  //     console.error("Test failed:", e);
  //     throw e;
  //   }
  // });

  it("Create coinflip game", async () => {
    console.log("\n🎬 Starting: Create Coinflip Game Test");
    try {
      initialPlayerBalance = new BN(
        await program.provider.connection.getBalance(player.publicKey)
      );
      console.log(
        `👤 Initial Player Balance: ${
          initialPlayerBalance.toNumber() / LAMPORTS_PER_SOL
        } SOL`
      );

      initialHouseTreasuryBalance = new BN(
        await program.provider.connection.getBalance(houseTreasury)
      );
      console.log(
        `🏦 Initial House Treasury Balance: ${
          initialHouseTreasuryBalance.toNumber() / LAMPORTS_PER_SOL
        } SOL`
      );

      const playerChoice: PlayerChoice = { option1: {} };
      console.log(`🎲 Player's Choice: Option 1`);

      const tx = await program.methods
        .createCoinflip(room_id, amount, playerChoice)
        .accounts({
          player: player.publicKey,
          coinflip,
          houseTreasury,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log(`✅ Coinflip game created successfully!`);
      console.log(`📜 Transaction Signature: ${tx}`);

      const gameData = await program.account.coinflip.fetch(coinflip);
      console.log(`\n📊 Game Data After Creation:`);
      // console.log(`   Room ID: ${gameData.roomId}`);
      console.log(`   Player: ${gameData.player.toBase58()}`);
      console.log(
        `   Bet Amount: ${gameData.amount.toNumber() / LAMPORTS_PER_SOL} SOL`
      );
      console.log(`   Player Choice: ${JSON.stringify(gameData.playerChoice)}`);
      console.log(`   Game Status: ${JSON.stringify(gameData.status)}`);
    } catch (e) {
      console.error("❌ Error creating coinflip game:", e);
      throw e;
    }
  });

  it("Play the game", async () => {
    console.log("\n🎮 Starting: Play the Game Test");
    try {
      force = Keypair.generate().publicKey;
      console.log(`🔮 New Force Public Key: ${force.toBase58()}`);

      const random = randomnessAccountAddress(force.toBuffer());
      console.log(`🎲 Random Account Address: ${random.toBase58()}`);

      const tx = await program.methods
        .playCoinflip(room_id, Array.from(force.toBuffer()))
        .accounts({
          player: player.publicKey,
          coinflip: coinflip,
          houseTreasury: houseTreasury,
          oraoTreasury: oraoTreasury,
          vrf: vrf.programId,
          config: networkState,
          random,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log(`✅ Game has started successfully!`);
      console.log(`📜 Transaction Signature: ${tx}`);

      const gameState = await program.account.coinflip.fetch(coinflip);
      console.log(`\n📊 Game State After Play:`);
      // console.log(`   Room ID: ${gameState.roomId}`);
      console.log(`   Player: ${gameState.player.toBase58()}`);
      console.log(
        `   Bet Amount: ${gameState.amount.toNumber() / LAMPORTS_PER_SOL} SOL`
      );
      console.log(
        `   Player Choice: ${JSON.stringify(gameState.playerChoice)}`
      );
      console.log(`   Game Status: ${JSON.stringify(gameState.status)}`);

      assert.deepEqual(
        gameState.status,
        { processing: {} },
        "Game status should be 'processing' after play"
      );
      console.log(`✅ Assertion passed: Game status is 'processing'`);
    } catch (e) {
      console.error("❌ Error playing the game:", e);
      throw e;
    }
  });

  it("Wait for randomness fulfillment", async () => {
    console.log("\n⏳ Starting: Wait for Randomness Fulfillment Test");
    console.log(`   Waiting for ORAO VRF to fulfill the randomness request...`);
    await vrf.waitFulfilled(force.toBuffer());
    console.log(`✅ Randomness has been fulfilled by ORAO VRF`);
    console.log(`   We can now proceed to get the game result`);
  });

  it("Get the result", async () => {
    console.log("\n🏁 Starting: Get the Game Result Test");
    try {
      const random = randomnessAccountAddress(Buffer.from(force.toBuffer()));
      console.log(`🎲 Random Account Address: ${random.toBase58()}`);

      const tx = await program.methods
        .resultCoinflip(room_id, Array.from(force.toBuffer()))
        .accounts({
          player: player.publicKey,
          coinflip: coinflip,
          houseTreasury: houseTreasury,
          oraoTreasury: oraoTreasury,
          vrf: vrf.programId,
          config: networkState,
          random,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log(`✅ Game result has been processed successfully!`);
      console.log(`📜 Transaction Signature: ${tx}`);

      const gameResult = await program.account.coinflip.fetch(coinflip);
      console.log(`\n📊 Final Game Result:`);
      // console.log(`   Room ID: ${gameResult.roomId}`);
      console.log(`   Player: ${gameResult.player.toBase58()}`);
      console.log(
        `   Bet Amount: ${gameResult.amount.toNumber() / LAMPORTS_PER_SOL} SOL`
      );
      console.log(
        `   Player Choice: ${JSON.stringify(gameResult.playerChoice)}`
      );
      console.log(`   Game Status: ${JSON.stringify(gameResult.status)}`);
      console.log(`   Winner: ${JSON.stringify(gameResult.result)}`);

      const playerBalance = await program.provider.connection.getBalance(
        player.publicKey
      );
      const houseTreasuryBalance = await program.provider.connection.getBalance(
        houseTreasury
      );
      console.log(`\n💰 Final Balances:`);
      console.log(`   Player balance: ${playerBalance / LAMPORTS_PER_SOL} SOL`);
      console.log(
        `   House Treasury balance: ${
          houseTreasuryBalance / LAMPORTS_PER_SOL
        } SOL`
      );

      const playerBalanceChange =
        (playerBalance - initialPlayerBalance.toNumber()) / LAMPORTS_PER_SOL;
      const treasuryBalanceChange =
        (houseTreasuryBalance - initialHouseTreasuryBalance.toNumber()) /
        LAMPORTS_PER_SOL;

      console.log(`\n📈 Balance Changes:`);
      console.log(
        `   Player: ${
          playerBalanceChange > 0 ? "+" : ""
        }${playerBalanceChange.toFixed(4)} SOL`
      );
      console.log(
        `   House Treasury: ${
          treasuryBalanceChange > 0 ? "+" : ""
        }${treasuryBalanceChange.toFixed(4)} SOL`
      );
    } catch (e) {
      console.error("❌ Error getting the game result:", e);
      throw e;
    }
  });

  // it("Pauses the program and fails to play a game", async () => {
  //   console.log("\n🛑 Starting: Program Pause and Play Attempt Test");
  //   try {
  //     console.log(`   Attempting to pause the program...`);
  //     const pauseTx = await program.methods
  //       .togglePause()
  //       .accounts({
  //         authority: player.publicKey,
  //         houseTreasury: houseTreasury,
  //       })
  //       .rpc();
  //     console.log(`✅ Program paused successfully!`);
  //     console.log(`📜 Pause Transaction Signature: ${pauseTx}`);

  //     const houseTreasuryAccount = await program.account.houseTreasury.fetch(
  //       houseTreasury
  //     );
  //     assert.isTrue(houseTreasuryAccount.paused, "Program should be paused");
  //     console.log(`✅ Assertion passed: Program is confirmed to be paused`);

  //     console.log(
  //       `\n   Attempting to create a coinflip game while paused (this should fail)...`
  //     );
  //     const playerChoice = { option1: {} };
  //     try {
  //       await program.methods
  //         .createCoinflip(room_id, amount, playerChoice)
  //         .accounts({
  //           player: player.publicKey,
  //           coinflip: coinflip,
  //           houseTreasury: houseTreasury,
  //           systemProgram: SystemProgram.programId,
  //           clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
  //         })
  //         .rpc();

  //       assert.fail(
  //         "Creating a coinflip game should have failed while the program is paused"
  //       );
  //     } catch (error) {
  //       console.log(`✅ Coinflip game creation failed as expected`);
  //       assert.include(
  //         error.message,
  //         "Program is currently paused",
  //         "Error should indicate that the program is paused"
  //       );
  //       console.log(
  //         `✅ Assertion passed: Error message indicates program is paused`
  //       );
  //     }

  //     console.log(`\n   Unpausing the program for cleanup...`);
  //     await program.methods
  //       .togglePause()
  //       .accounts({
  //         authority: player.publicKey,
  //         houseTreasury: houseTreasury,
  //       })
  //       .rpc();
  //     console.log(`✅ Program unpaused successfully`);
  //   } catch (e) {
  //     console.error("❌ Test failed:", e);
  //     throw e;
  //   }
  // });

  // it("Withdraw funds from treasury", async () => {
  //   console.log("\n💼 Starting: Withdraw Funds from Treasury Test");
  //   try {
  //     const initialTreasuryBalance =
  //       await program.provider.connection.getBalance(houseTreasury);
  //     console.log(
  //       `   Initial Treasury Balance: ${
  //         initialTreasuryBalance / LAMPORTS_PER_SOL
  //       } SOL`
  //     );

  //     const initialAuthorityBalance =
  //       await program.provider.connection.getBalance(player.publicKey);
  //     console.log(
  //       `   Initial Authority Balance: ${
  //         initialAuthorityBalance / LAMPORTS_PER_SOL
  //       } SOL`
  //     );

  //     const withdrawAmount = Math.floor(initialTreasuryBalance / 2);
  //     console.log(
  //       `   Attempting to withdraw: ${withdrawAmount / LAMPORTS_PER_SOL} SOL`
  //     );

  //     const tx = await program.methods
  //       .withdrawHouseFunds(new BN(withdrawAmount))
  //       .accounts({
  //         authority: player.publicKey,
  //         houseTreasury: houseTreasury,
  //         systemProgram: SystemProgram.programId,
  //       })
  //       .rpc();

  //     console.log(`✅ Withdrawal transaction successful!`);
  //     console.log(`📜 Transaction Signature: ${tx}`);

  //     const newTreasuryBalance = await program.provider.connection.getBalance(
  //       houseTreasury
  //     );
  //     console.log(
  //       `   New Treasury Balance: ${newTreasuryBalance / LAMPORTS_PER_SOL} SOL`
  //     );

  //     const newAuthorityBalance = await program.provider.connection.getBalance(
  //       player.publicKey
  //     );
  //     console.log(
  //       `   New Authority Balance: ${
  //         newAuthorityBalance / LAMPORTS_PER_SOL
  //       } SOL`
  //     );

  //     // Assert that the treasury balance has decreased by the withdrawn amount
  //     assert.approximately(
  //       initialTreasuryBalance - newTreasuryBalance,
  //       withdrawAmount,
  //       LAMPORTS_PER_SOL / 100, // Allow for a small difference due to transaction fees
  //       "Treasury balance should have decreased by the withdrawn amount"
  //     );
  //     console.log(`✅ Assertion passed: Treasury balance decreased correctly`);

  //     // Assert that the authority received the funds (minus transaction fees)
  //     const withdrawnAmount = newAuthorityBalance - initialAuthorityBalance;
  //     assert(withdrawnAmount > 0, "Authority should have received funds");
  //     assert.approximately(
  //       withdrawnAmount,
  //       withdrawAmount,
  //       LAMPORTS_PER_SOL / 100, // Allow for a small difference due to transaction fees
  //       "Withdrawn amount should match the requested amount"
  //     );
  //     console.log(
  //       `✅ Assertion passed: Authority received the correct amount of funds`
  //     );

  //     console.log(`\n📊 Withdrawal Summary:`);
  //     console.log(
  //       `   Withdrawn amount: ${withdrawnAmount / LAMPORTS_PER_SOL} SOL`
  //     );
  //     console.log(
  //       `   Treasury balance change: -${
  //         (initialTreasuryBalance - newTreasuryBalance) / LAMPORTS_PER_SOL
  //       } SOL`
  //     );
  //     console.log(
  //       `   Authority balance change: +${
  //         (newAuthorityBalance - initialAuthorityBalance) / LAMPORTS_PER_SOL
  //       } SOL`
  //     );
  //   } catch (e) {
  //     console.error("❌ Error withdrawing funds from treasury:", e);
  //     throw e;
  //   }
  // });
});
