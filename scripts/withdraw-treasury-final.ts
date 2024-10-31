import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as fs from "fs";

async function main() {
  try {
    const connection = new Connection("https://api.mainnet-beta.solana.com");

    // Load your authority wallet
    const keypair = Keypair.fromSecretKey(
      Buffer.from(
        JSON.parse(
          fs.readFileSync(
            "/Users/atlas-ryan/.config/solana/new-mainnet-deployer.json",
            "utf-8"
          )
        )
      )
    );

    const treasuryPDA = new PublicKey(
      "3FswWph2383p8wfLhCQuY92cfdYSWtTS4RUi1BXnE5p4"
    );

    // Get current balance
    const balance = await connection.getBalance(treasuryPDA);
    console.log(`Treasury balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    // Create transfer instruction
    const transferIx = SystemProgram.transfer({
      fromPubkey: treasuryPDA,
      toPubkey: keypair.publicKey,
      lamports: balance - 5000, // Leave 5000 lamports for rent
    });

    const tx = new Transaction().add(transferIx);

    // Send and confirm transaction
    const sig = await connection.sendTransaction(tx, [keypair]);
    console.log("Transaction sent:", sig);

    await connection.confirmTransaction(sig);

    // Check new balance
    const newBalance = await connection.getBalance(treasuryPDA);
    console.log(`New treasury balance: ${newBalance / LAMPORTS_PER_SOL} SOL`);
  } catch (e) {
    console.error("Error:", e);
  }
}

main();
