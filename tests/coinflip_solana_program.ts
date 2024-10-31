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

  const amount = new BN(LAMPORTS_PER_SOL * 0.05);
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
  //VRFzZoJdhFWL8rkvu87LpKM3RbcVezpMEc6X5GVDr7y mainnet ORAO VRF Treasury address
  //9ZTHWWZDpB36UFe1vszf2KEpt83vwi27jDqtHQ7NSXyR testnet ORAO VRF Treasury address
  console.log(`💼 ORAO Treasury Address: ${oraoTreasury.toBase58()}`);

  before(async () => {
    force = Keypair.generate().publicKey;
    console.log(`🔮 Generated Force Public Key: ${force.toBase58()}`);
  });

  // it("Initialize house treasury", async () => {
  //   console.log("\n🏦 Starting: Initialize House Treasury Test");
  //   try {
  //     const tx = await program.methods
  //       .initializeHouse()
  //       .accounts({
  //         houseTreasury,
  //         authority: player.publicKey,
  //         systemProgram: SystemProgram.programId,
  //       })
  //       .rpc();
  //     console.log("✅ House treasury initialized successfully");
  //     console.log(`📜 Transaction Signature: ${tx}`);
  //   } catch (e) {
  //     console.log("House treasury already initialized or error:", e);
  //   }
  // });

  // it("Fund house treasury", async () => {
  //   console.log("\n💰 Starting: Fund House Treasury Test");
  //   try {
  //     const fundAmount = new BN(LAMPORTS_PER_SOL * 0.5); // 0.5 SOL
  //     const tx = await program.methods
  //       .fundTreasury(fundAmount)
  //       .accounts({
  //         funder: player.publicKey,
  //         houseTreasury,
  //         systemProgram: SystemProgram.programId,
  //       })
  //       .rpc();
  //     console.log(
  //       `✅ House treasury funded with ${
  //         fundAmount.toNumber() / LAMPORTS_PER_SOL
  //       } SOL`
  //     );
  //     console.log(`📜 Transaction Signature: ${tx}`);

  //     const treasuryBalance = await program.provider.connection.getBalance(
  //       houseTreasury
  //     );
  //     console.log(
  //       `🏦 House Treasury Balance: ${treasuryBalance / LAMPORTS_PER_SOL} SOL`
  //     );
  //   } catch (e) {
  //     console.error("❌ Error funding house treasury:", e);
  //     throw e;
  //   }
  // });
  // it("Withdraw from house treasury", async () => {
  //   console.log("\n💸 Starting: Withdraw from House Treasury Test");
  //   try {
  //     // Check if house treasury exists
  //     const houseTreasuryAccount = await program.account.houseTreasury.fetch(
  //       houseTreasury
  //     );
  //     console.log("House Treasury Account:", houseTreasuryAccount);

  //     // Get the initial balances
  //     const initialTreasuryBalance =
  //       await program.provider.connection.getBalance(houseTreasury);
  //     const initialDeployerBalance =
  //       await program.provider.connection.getBalance(player.publicKey);

  //     console.log(
  //       `🏦 Initial House Treasury Balance: ${
  //         initialTreasuryBalance / LAMPORTS_PER_SOL
  //       } SOL`
  //     );
  //     console.log(
  //       `👤 Initial Deployer Balance: ${
  //         initialDeployerBalance / LAMPORTS_PER_SOL
  //       } SOL`
  //     );

  //     // Amount to withdraw (0.1 SOL)
  //     const withdrawAmount = new BN(LAMPORTS_PER_SOL * 0.1);

  //     // Check if house treasury has enough balance
  //     if (initialTreasuryBalance < withdrawAmount.toNumber()) {
  //       throw new Error(
  //         "House treasury doesn't have enough balance for withdrawal"
  //       );
  //     }

  //     // Perform the withdrawal
  //     const tx = await program.methods
  //       .withdrawHouseFunds(withdrawAmount)
  //       .accounts({
  //         authority: player.publicKey,
  //         houseTreasury,
  //         systemProgram: SystemProgram.programId,
  //       })
  //       .rpc();

  //     console.log(`✅ Withdrawal transaction successful`);
  //     console.log(`📜 Transaction Signature: ${tx}`);

  //     // ... rest of the test ...
  //   } catch (e) {
  //     console.error("❌ Error withdrawing from house treasury:", e);
  //     throw e;
  //   }
  // });

  it("Create and play coinflip game", async () => {
    console.log("\n🎬 Starting: Create and Play Coinflip Game Test");
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

      const playerChoice = { option1: {} };
      console.log(`🎲 Player's Choice: Option1`);

      force = Keypair.generate().publicKey;
      console.log(`🔮 Force Public Key: ${force.toBase58()}`);

      const random = randomnessAccountAddress(force.toBuffer());
      console.log(`🎲 Random Account Address: ${random.toBase58()}`);

      const tx = await program.methods
        .createAndPlayCoinflip(
          room_id,
          amount,
          playerChoice,
          Array.from(force.toBuffer())
        )
        .accounts({
          player: player.publicKey,
          coinflip,
          houseTreasury,
          oraoTreasury,
          vrf: vrf.programId,
          config: networkState,
          random,
          systemProgram: SystemProgram.programId,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .rpc();

      console.log(`✅ Coinflip game created and started successfully!`);
      console.log(`📜 Transaction Signature: ${tx}`);

      const gameData = await program.account.coinflip.fetch(coinflip);
      console.log(`\n📊 Game Data After Creation and Play:`);
      console.log(`   Player: ${gameData.player.toBase58()}`);
      console.log(
        `   Bet Amount: ${gameData.amount.toNumber() / LAMPORTS_PER_SOL} SOL`
      );
      console.log(`   Player Choice: ${JSON.stringify(gameData.playerChoice)}`);
      console.log(`   Game Status: ${JSON.stringify(gameData.status)}`);

      assert.deepEqual(
        gameData.status,
        { processing: {} },
        "Game status should be 'processing' after create and play"
      );
      console.log(`✅ Assertion passed: Game status is 'processing'`);
    } catch (e) {
      console.error("❌ Error creating and playing coinflip game:", e);
      throw e;
    }
  });

  it("Wait for randomness fulfillment", async () => {
    console.log("\n⏳ Starting: Wait for Randomness Fulfillment Test");
    console.log(`   Waiting for ORAO VRF to fulfill the randomness request...`);
    await vrf.waitFulfilled(force.toBuffer());
    console.log(`✅ Randomness has been fulfilled by ORAO VRF`);
  });

  it("Finalize game", async () => {
    console.log("\n🏁 Starting: Finalize Game Test");
    try {
      const random = randomnessAccountAddress(Buffer.from(force.toBuffer()));
      console.log(`🎲 Random Account Address: ${random.toBase58()}`);

      const tx = await program.methods
        .finalizeGame(room_id)
        .accounts({
          coinflip,
          random,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log(`✅ Game finalized successfully!`);
      console.log(`📜 Transaction Signature: ${tx}`);

      const gameData = await program.account.coinflip.fetch(coinflip);
      console.log(`\n📊 Game Data After Finalization:`);
      console.log(`   Player: ${gameData.player.toBase58()}`);
      console.log(
        `   Bet Amount: ${gameData.amount.toNumber() / LAMPORTS_PER_SOL} SOL`
      );
      console.log(`   Player Choice: ${JSON.stringify(gameData.playerChoice)}`);
      console.log(`   Game Status: ${JSON.stringify(gameData.status)}`);
      console.log(`   Game Result: ${JSON.stringify(gameData.result)}`);

      assert.deepEqual(
        gameData.status,
        { finished: {} },
        "Game status should be 'finished' after finalization"
      );
      console.log(`✅ Assertion passed: Game status is 'finished'`);
    } catch (e) {
      console.error("❌ Error finalizing game:", e);
      throw e;
    }
  });

  it("Claim rewards if won", async () => {
    console.log("\n💰 Starting: Claim Rewards Test");
    try {
      const gameData = await program.account.coinflip.fetch(coinflip);
      console.log(`\n📊 Game Result:`);
      console.log(`   Player Choice: ${JSON.stringify(gameData.playerChoice)}`);
      console.log(`   Game Result: ${JSON.stringify(gameData.result)}`);

      const playerWon = gameData.result
        ? (gameData.result.option1Wins && gameData.playerChoice.option1) ||
          (gameData.result.option2Wins && gameData.playerChoice.option2) ||
          (gameData.result.tie && gameData.playerChoice.tie)
        : false;

      if (playerWon) {
        console.log("Player won! Attempting to claim rewards...");
        const tx = await program.methods
          .claimRewards(room_id)
          .accounts({
            player: player.publicKey,
            coinflip,
            houseTreasury,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        console.log(`✅ Rewards claimed successfully!`);
        console.log(`📜 Transaction Signature: ${tx}`);
      } else {
        console.log("Player did not win. No rewards to claim.");
      }

      // Fetch final balances
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
      console.error("❌ Error claiming rewards:", e);
      throw e;
    }
  });
});
