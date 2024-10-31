import * as anchor from "@project-serum/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import fs from "fs";

// Define the HouseTreasury type
interface HouseTreasury {
  authority: PublicKey;
  balance: anchor.BN;
  paused: boolean;
}

async function main() {
  const connection = new Connection("https://api.mainnet-beta.solana.com");

  // Load your wallet keypair
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

  // Create provider
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const program = new anchor.Program(
    require("../target/idl/solana_coinflip_game.json"),
    "6MNUPzTs5MMGNrvnCdGyMDJ6mH7ciE3MyzbaeYGwdQxi",
    provider
  );

  const treasury = new PublicKey(
    "3FswWph2383p8wfLhCQuY92cfdYSWtTS4RUi1BXnE5p4"
  );

  try {
    const treasuryAccount = (await program.account.houseTreasury.fetch(
      treasury
    )) as HouseTreasury;
    console.log("\nTreasury Account Data:");
    console.log(
      "Balance in state:",
      treasuryAccount.balance.toNumber() / anchor.web3.LAMPORTS_PER_SOL,
      "SOL"
    );
    console.log("Authority:", treasuryAccount.authority.toBase58());
    console.log("Paused:", treasuryAccount.paused);

    const solBalance = await connection.getBalance(treasury);
    console.log(
      "\nActual SOL Balance:",
      solBalance / anchor.web3.LAMPORTS_PER_SOL,
      "SOL"
    );

    // Calculate difference
    console.log(
      "\nDifference (Actual - State):",
      (solBalance - treasuryAccount.balance.toNumber()) /
        anchor.web3.LAMPORTS_PER_SOL,
      "SOL"
    );
  } catch (e) {
    console.error("Error:", e);
  }
}

main();
