import * as anchor from "@project-serum/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import fs from "fs";

async function main() {
  console.log("\n💰 Starting Treasury Withdrawal Process\n");

  const connection = new Connection("https://api.mainnet-beta.solana.com");

  // Load your deployer wallet (must be the authority of the treasury)
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

  // Your treasury PDA
  const treasury = new PublicKey(
    "3FswWph2383p8wfLhCQuY92cfdYSWtTS4RUi1BXnE5p4"
  );

  try {
    // Get current balance
    const currentBalance = await connection.getBalance(treasury);
    console.log(
      `Current treasury balance: ${currentBalance / LAMPORTS_PER_SOL} SOL`
    );

    // Leave 0.01 SOL for rent (10000000 lamports)
    const withdrawAmount = new anchor.BN(currentBalance - 10000000);

    console.log(
      `\nAttempting to withdraw ${
        withdrawAmount.toNumber() / LAMPORTS_PER_SOL
      } SOL`
    );

    const tx = await program.methods
      .withdrawHouseFunds(withdrawAmount)
      .accounts({
        authority: wallet.publicKey,
        houseTreasury: treasury,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("\n✅ Withdrawal successful!");
    console.log(`📜 Transaction signature: ${tx}`);

    // Check final balance
    const finalBalance = await connection.getBalance(treasury);
    console.log(
      `\n💰 Final treasury balance: ${finalBalance / LAMPORTS_PER_SOL} SOL`
    );
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
