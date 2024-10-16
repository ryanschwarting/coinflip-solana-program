import * as anchor from "@project-serum/anchor";
import {
  PublicKey,
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import fs from "fs";
import path from "path";

async function main() {
  console.log("\n🎲 Starting Solana Coinflip Game Test Suite 🎲\n");

  // Connect to mainnet
  const connection = new Connection("https://api.mainnet-beta.solana.com");

  // Load your wallet keypair
  const walletKeypair = Keypair.fromSecretKey(
    Buffer.from(
      JSON.parse(
        fs.readFileSync(
          path.resolve(
            process.env.HOME,
            ".config/solana/new-mainnet-deployer.json"
          ),
          "utf-8"
        )
      )
    )
  );

  // Create a wallet object
  const wallet = new anchor.Wallet(walletKeypair);

  console.log(`👤 Player's Public Key: ${wallet.publicKey.toBase58()}`);

  // Check wallet balance
  const walletBalance = await connection.getBalance(wallet.publicKey);
  console.log(`💰 Wallet Balance: ${walletBalance / 1e9} SOL`);

  if (walletBalance === 0) {
    console.error(
      "❌ Error: Wallet has no SOL. Please fund it before continuing."
    );
    return;
  }

  const houseTreasury = new PublicKey(
    "3FswWph2383p8wfLhCQuY92cfdYSWtTS4RUi1BXnE5p4"
  );
  console.log(`🏦 House Treasury Address: ${houseTreasury.toBase58()}`);

  // Check house treasury balance
  const treasuryBalance = await connection.getBalance(houseTreasury);
  console.log(`💰 House Treasury Balance: ${treasuryBalance / 1e9} SOL`);

  // Amount to transfer (0.01 SOL)
  const transferAmount = 0.01 * 1e9; // in lamports

  try {
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: houseTreasury,
        lamports: transferAmount,
      })
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [
      walletKeypair,
    ]);

    console.log(`✅ Transfer successful`);
    console.log(`📜 Transaction Signature: ${signature}`);

    // Check new balances
    const newWalletBalance = await connection.getBalance(wallet.publicKey);
    const newTreasuryBalance = await connection.getBalance(houseTreasury);

    console.log(`\n💰 New Wallet Balance: ${newWalletBalance / 1e9} SOL`);
    console.log(
      `💰 New House Treasury Balance: ${newTreasuryBalance / 1e9} SOL`
    );
  } catch (e) {
    console.error("❌ Error transferring SOL to house treasury:", e);
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
