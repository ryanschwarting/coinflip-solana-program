import * as anchor from "@project-serum/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  networkStateAccountAddress,
  Orao,
  randomnessAccountAddress,
} from "@orao-network/solana-vrf";
import fs from "fs";

interface GameResult {
  option1Wins?: {};
  option2Wins?: {};
  tie?: {};
}

interface PlayerChoice {
  option1?: {};
  option2?: {};
  tie?: {};
}

interface CoinflipAccount {
  player: PublicKey;
  amount: anchor.BN;
  playerChoice: PlayerChoice;
  force: number[];
  result: GameResult | null;
  status: { waiting: {} } | { processing: {} } | { finished: {} };
  lastPlayTime: anchor.BN;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRandomness(vrf: Orao, force: Buffer, maxAttempts = 30) {
  console.log("\n2️⃣ Waiting for VRF fulfillment...");

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await vrf.waitFulfilled(force);
      console.log("✅ VRF fulfilled!");
      return;
    } catch (e) {
      if (attempt === maxAttempts) {
        throw new Error(
          `Failed to get randomness after ${maxAttempts} attempts`
        );
      }
      console.log(
        `Attempt ${attempt}/${maxAttempts} - Waiting for VRF account...`
      );
      await sleep(2000); // Wait 2 seconds between attempts
    }
  }
}

async function main() {
  console.log("\n🎮 Starting Coinflip Game Test\n");

  const connection = new Connection("https://api.mainnet-beta.solana.com", {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 60000, // 60 seconds
  });

  const walletKeypair = Keypair.fromSecretKey(
    Buffer.from(
      JSON.parse(
        fs.readFileSync(
          "/Users/atlas-ryan/.config/solana/new-mainnet-deployer.json",
          "utf-8"
        )
      )
    )
  );

  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  const program = new anchor.Program(
    require("../target/idl/solana_coinflip_game.json"),
    "6MNUPzTs5MMGNrvnCdGyMDJ6mH7ciE3MyzbaeYGwdQxi",
    provider
  );

  const treasury = new PublicKey(
    "3FswWph2383p8wfLhCQuY92cfdYSWtTS4RUi1BXnE5p4"
  );

  // Generate random room ID
  const roomId = Math.random().toString(36).substring(2, 10);
  console.log(`🏠 Room ID: ${roomId}`);

  // Setup ORAO VRF
  const vrf = new Orao(provider as any);
  const networkState = networkStateAccountAddress();
  console.log(`🌐 Network State Address: ${networkState.toBase58()}`);

  // Generate force
  const forceKeypair = Keypair.generate();
  const force = Array.from(forceKeypair.publicKey.toBuffer());
  console.log(`🔮 Force Public Key: ${forceKeypair.publicKey.toBase58()}`);

  try {
    // Log initial balances
    const initialPlayerBalance = await connection.getBalance(wallet.publicKey);
    const initialTreasuryBalance = await connection.getBalance(treasury);

    console.log("\n💰 Initial Balances:");
    console.log(`Player: ${initialPlayerBalance / LAMPORTS_PER_SOL} SOL`);
    console.log(`Treasury: ${initialTreasuryBalance / LAMPORTS_PER_SOL} SOL`);

    // Get the PDA for the coinflip game account
    const [coinflipPDA] = await PublicKey.findProgramAddress(
      [Buffer.from("coinflip"), Buffer.from(roomId)],
      program.programId
    );
    console.log(`🎰 Coinflip PDA: ${coinflipPDA.toBase58()}`);

    const random = randomnessAccountAddress(forceKeypair.publicKey.toBuffer());
    console.log(`🎲 Random Account Address: ${random.toBase58()}`);

    // 1. Create and play game
    console.log("\n1️⃣ Creating and playing game...");

    const betAmount = new anchor.BN(0.05 * LAMPORTS_PER_SOL); // 0.05 SOL bet

    const createTx = await program.methods
      .createAndPlayCoinflip(
        roomId,
        betAmount,
        { option2: {} }, // Betting on Option2
        force
      )
      .accounts({
        player: wallet.publicKey,
        coinflip: coinflipPDA,
        houseTreasury: treasury,
        oraoTreasury: new PublicKey(
          "9ZTHWWZDpB36UFe1vszf2KEpt83vwi27jDqtHQ7NSXyR"
        ),
        vrf: vrf.programId,
        config: networkState,
        random,
        systemProgram: SystemProgram.programId,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      })
      .rpc({ skipPreflight: true });

    await connection.confirmTransaction(createTx, "confirmed");
    console.log("Game created! Tx:", createTx);

    // 2. Wait for VRF
    console.log("\n2️⃣ Waiting for VRF fulfillment...");
    await waitForRandomness(vrf, forceKeypair.publicKey.toBuffer());
    console.log("VRF fulfilled!");

    // 3. Finalize game with better error handling
    console.log("\n3️⃣ Finalizing game...");
    const finalizeTx = await program.methods
      .finalizeGame(roomId)
      .accounts({
        coinflip: coinflipPDA,
        random,
        systemProgram: SystemProgram.programId,
      })
      .rpc({ skipPreflight: true });

    console.log("Waiting for finalization confirmation...");
    await connection.confirmTransaction(finalizeTx, "confirmed");
    await sleep(2000);

    // Multiple attempts to fetch final state
    let gameData: CoinflipAccount | null = null;
    for (let i = 0; i < 5; i++) {
      try {
        gameData = (await program.account.coinflip.fetch(
          coinflipPDA
        )) as CoinflipAccount;
        if (gameData.result !== null) break;
        await sleep(1000);
      } catch (e) {
        console.log(`Attempt ${i + 1} failed, retrying...`);
      }
    }

    if (!gameData) throw new Error("Failed to fetch game data");

    console.log("\n📊 Final Game State:");
    console.log("Status:", gameData.status);
    console.log("Player Choice:", gameData.playerChoice);
    console.log("Result:", gameData.result);

    // Determine if player won
    const playerWon = gameData.result
      ? (gameData.result.option1Wins && "option1" in gameData.playerChoice) ||
        (gameData.result.option2Wins && "option2" in gameData.playerChoice) ||
        (gameData.result.tie && "tie" in gameData.playerChoice)
      : false;

    console.log("\n🎲 Game Outcome:", playerWon ? "Won! 🎉" : "Lost 😢");

    // If game is won, retry claim a few times
    if (playerWon) {
      console.log("\n4️⃣ Won! Attempting to claim rewards...");
      let claimSuccess = false;
      for (let i = 0; i < 3; i++) {
        try {
          const claimTx = await program.methods
            .claimRewards(roomId)
            .accounts({
              player: wallet.publicKey,
              coinflip: coinflipPDA,
              houseTreasury: treasury,
              systemProgram: SystemProgram.programId,
            })
            .rpc({ skipPreflight: true });

          await connection.confirmTransaction(claimTx, "confirmed");
          claimSuccess = true;
          console.log("Rewards claimed! Tx:", claimTx);
          break;
        } catch (e) {
          console.log(`Claim attempt ${i + 1} failed, retrying...`);
          await sleep(1000);
        }
      }
      if (!claimSuccess) {
        console.log("Failed to claim rewards after multiple attempts");
      }
    }

    // Final balance check with retry
    let finalBalances = null;
    for (let i = 0; i < 3; i++) {
      try {
        const finalPlayerBalance = await connection.getBalance(
          wallet.publicKey
        );
        const finalTreasuryBalance = await connection.getBalance(treasury);
        finalBalances = { finalPlayerBalance, finalTreasuryBalance };
        break;
      } catch (e) {
        console.log(`Balance check attempt ${i + 1} failed, retrying...`);
        await sleep(1000);
      }
    }

    if (finalBalances) {
      // Log final balances
      console.log("\n💰 Final Balances:");
      console.log(
        `Player: ${finalBalances.finalPlayerBalance / LAMPORTS_PER_SOL} SOL`
      );
      console.log(
        `Treasury: ${finalBalances.finalTreasuryBalance / LAMPORTS_PER_SOL} SOL`
      );

      // Calculate and log changes
      const playerBalanceChange =
        (finalBalances.finalPlayerBalance - initialPlayerBalance) /
        LAMPORTS_PER_SOL;
      const treasuryBalanceChange =
        (finalBalances.finalTreasuryBalance - initialTreasuryBalance) /
        LAMPORTS_PER_SOL;

      console.log("\n📊 Balance Changes:");
      console.log(
        `Player: ${
          playerBalanceChange > 0 ? "+" : ""
        }${playerBalanceChange.toFixed(4)} SOL`
      );
      console.log(
        `Treasury: ${
          treasuryBalanceChange > 0 ? "+" : ""
        }${treasuryBalanceChange.toFixed(4)} SOL`
      );
    }
  } catch (e) {
    console.error("\n❌ Error:", e);
    throw e;
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
