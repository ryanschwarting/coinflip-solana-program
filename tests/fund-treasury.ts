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
  console.log("\n💰 Starting Treasury Fund Process\n");

  const connection = new Connection("https://api.mainnet-beta.solana.com");

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

  try {
    // Get current balance
    const currentBalance = await connection.getBalance(treasury);
    console.log(
      `Current treasury balance: ${currentBalance / LAMPORTS_PER_SOL} SOL`
    );

    // Fund with 0.3 SOL
    const fundAmount = new anchor.BN(0.3 * LAMPORTS_PER_SOL);

    console.log(
      `\nAttempting to fund with ${
        fundAmount.toNumber() / LAMPORTS_PER_SOL
      } SOL`
    );

    const tx = await program.methods
      .fundTreasury(fundAmount)
      .accounts({
        funder: wallet.publicKey,
        houseTreasury: treasury,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("\n✅ Funding successful!");
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
