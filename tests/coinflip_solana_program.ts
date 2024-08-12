import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SolanaCoinflipGame } from "../target/types/solana_coinflip_game";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
// import { BN } from "bn.js";
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
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .SolanaCoinflipGame as Program<SolanaCoinflipGame>;
  const player = provider.wallet;

  let initialPlayerBalance: BN;
  let initialHouseTreasuryBalance: BN;

  const room_id = randomString();
  const amount = new BN(LAMPORTS_PER_SOL * 0.1);
  const [coinflip] = PublicKey.findProgramAddressSync(
    [Buffer.from("coinflip"), Buffer.from(room_id)],
    program.programId
  );
  const [houseTreasury] = PublicKey.findProgramAddressSync(
    [Buffer.from("house_treasury")],
    program.programId
  );

  console.log("House Treasury PDA address:", houseTreasury.toBase58());

  const vrf = new Orao(provider as any);
  const networkState = networkStateAccountAddress();
  let force: PublicKey;
  const oraoTreasury = new PublicKey(
    "9ZTHWWZDpB36UFe1vszf2KEpt83vwi27jDqtHQ7NSXyR"
  );

  before(async () => {
    force = Keypair.generate().publicKey;
    console.log("Force:", force.toBase58());
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
    try {
      initialPlayerBalance = new BN(
        await program.provider.connection.getBalance(player.publicKey)
      );
      initialHouseTreasuryBalance = new BN(
        await program.provider.connection.getBalance(houseTreasury)
      );
      const playerChoice: PlayerChoice = { option1: {} }; // or { option2: {} }
      const tx = await program.methods
        .createCoinflip(room_id, amount, playerChoice)
        .accounts({
          player: player.publicKey,
          coinflip,
          houseTreasury,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log("Coinflip game created, tx:", tx);
      console.log(
        "Program account data: ",
        await program.account.coinflip.fetch(coinflip)
      );
    } catch (e) {
      console.error("Error creating coinflip game:", e);
      throw e;
    }
  });

  it("Play the game", async () => {
    try {
      force = Keypair.generate().publicKey;
      const random = randomnessAccountAddress(force.toBuffer());

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

      console.log(`Game has started, randomness is requested: `, tx);
      const gameState = await program.account.coinflip.fetch(coinflip);
      console.log("Game state after play:", gameState);
      assert.deepEqual(
        gameState.status,
        { processing: {} },
        "Game status should be 'processing' after play"
      );
    } catch (e) {
      console.error("Error playing the game:", e);
      throw e;
    }
  });

  it("Wait for randomness fulfillment", async () => {
    await vrf.waitFulfilled(force.toBuffer());
    console.log("Randomness is fulfilled, we can call the result function");
  });

  it("Get the result", async () => {
    try {
      const random = randomnessAccountAddress(Buffer.from(force.toBuffer()));

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

      console.log(`Game is finished`, tx);
      const gameResult = await program.account.coinflip.fetch(coinflip);
      console.log("Program account data: ", gameResult);

      // // Log the VRF number
      // const vrfBigNum = new BN(gameResult.force.slice(0, 8), "le");
      // const vrfNumber = vrfBigNum.mod(new BN(200)).toNumber();
      // const vrfNumber = vrfBigNum.toNumber();
      // console.log("VRF number (0-199):", vrfNumber);
      // console.log(
      //   "Game outcome:",
      //   vrfNumber < 10
      //     ? "Tie (5% chance)"
      //     : vrfNumber < 105
      //     ? "Option1 Wins (47.5% chance)"
      //     : "Option2 Wins (47.5% chance)"
      // );

      // Log balances after the game
      const playerBalance = await program.provider.connection.getBalance(
        player.publicKey
      );
      const houseTreasuryBalance = await program.provider.connection.getBalance(
        houseTreasury
      );
      console.log(
        "Player balance after game:",
        playerBalance / LAMPORTS_PER_SOL,
        "SOL"
      );
      console.log(
        "House Treasury balance after game:",
        houseTreasuryBalance / LAMPORTS_PER_SOL,
        "SOL"
      );
    } catch (e) {
      console.error("Error getting the result:", e);
      throw e;
    }
  });

  // it("Pauses the program and fails to play a game", async () => {
  //   try {
  //     // First, pause the program
  //     const pauseTx = await program.methods
  //       .togglePause()
  //       .accounts({
  //         authority: player.publicKey,
  //         houseTreasury: houseTreasury,
  //       })
  //       .rpc();
  //     console.log("Program paused. Transaction:", pauseTx);

  //     // Verify the program is paused
  //     const houseTreasuryAccount = await program.account.houseTreasury.fetch(
  //       houseTreasury
  //     );
  //     assert.isTrue(houseTreasuryAccount.paused, "Program should be paused");

  //     // Now try to create a coinflip game (this should fail)
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

  //       // If we reach here, the test should fail because the transaction should have thrown an error
  //       assert.fail(
  //         "Creating a coinflip game should have failed while the program is paused"
  //       );
  //     } catch (error) {
  //       // Check if the error is the one we expect (program paused)
  //       assert.include(
  //         error.message,
  //         "Program is currently paused",
  //         "Error should indicate that the program is paused"
  //       );
  //     }

  //     // Unpause the program for cleanup
  //     await program.methods
  //       .togglePause()
  //       .accounts({
  //         authority: player.publicKey,
  //         houseTreasury: houseTreasury,
  //       })
  //       .rpc();

  //     console.log("Program unpaused for cleanup");
  //   } catch (e) {
  //     console.error("Test failed:", e);
  //     throw e;
  //   }
  // });

  // it("Withdraw funds from treasury", async () => {
  //   try {
  //     // Get the current balance of the treasury
  //     const initialTreasuryBalance =
  //       await program.provider.connection.getBalance(houseTreasury);
  //     console.log(
  //       "Initial Treasury Balance:",
  //       initialTreasuryBalance / LAMPORTS_PER_SOL,
  //       "SOL"
  //     );

  //     // Get the current balance of the authority (player in this case)
  //     const initialAuthorityBalance =
  //       await program.provider.connection.getBalance(player.publicKey);
  //     console.log(
  //       "Initial Authority Balance:",
  //       initialAuthorityBalance / LAMPORTS_PER_SOL,
  //       "SOL"
  //     );

  //     // Define the amount to withdraw (e.g., half of the treasury balance)
  //     const withdrawAmount = Math.floor(initialTreasuryBalance / 2);

  //     // Perform the withdrawal
  //     const tx = await program.methods
  //       .withdrawHouseFunds(new BN(withdrawAmount))
  //       .accounts({
  //         authority: player.publicKey,
  //         houseTreasury: houseTreasury,
  //         systemProgram: SystemProgram.programId,
  //       })
  //       .rpc();

  //     console.log("Withdrawal transaction:", tx);

  //     // Get the new balance of the treasury
  //     const newTreasuryBalance = await program.provider.connection.getBalance(
  //       houseTreasury
  //     );
  //     console.log(
  //       "New Treasury Balance:",
  //       newTreasuryBalance / LAMPORTS_PER_SOL,
  //       "SOL"
  //     );

  //     // Get the new balance of the authority
  //     const newAuthorityBalance = await program.provider.connection.getBalance(
  //       player.publicKey
  //     );
  //     console.log(
  //       "New Authority Balance:",
  //       newAuthorityBalance / LAMPORTS_PER_SOL,
  //       "SOL"
  //     );

  //     // Assert that the treasury balance has decreased by the withdrawn amount
  //     assert.approximately(
  //       initialTreasuryBalance - newTreasuryBalance,
  //       withdrawAmount,
  //       LAMPORTS_PER_SOL / 100, // Allow for a small difference due to transaction fees
  //       "Treasury balance should have decreased by the withdrawn amount"
  //     );

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
  //       "Withdrawn amount:",
  //       withdrawnAmount / LAMPORTS_PER_SOL,
  //       "SOL"
  //     );
  //   } catch (e) {
  //     console.error("Error withdrawing funds from treasury:", e);
  //     throw e;
  //   }
  // });
});
