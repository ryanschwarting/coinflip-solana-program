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
      const vrfBigNum = new BN(gameResult.force.slice(0, 8), "le");
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

  // it("Get the result", async () => {
  //   try {
  //     const random = randomnessAccountAddress(Buffer.from(force.toBuffer()));

  //     const tx = await program.methods
  //       .resultCoinflip(room_id, Array.from(force.toBuffer()))
  //       .accounts({
  //         player: player.publicKey,
  //         coinflip: coinflip,
  //         houseTreasury: houseTreasury,
  //         oraoTreasury: oraoTreasury,
  //         vrf: vrf.programId,
  //         config: networkState,
  //         random,
  //         systemProgram: SystemProgram.programId,
  //       })
  //       .rpc();

  //     console.log(`Game is finished`, tx);
  //     const gameResult = await program.account.coinflip.fetch(coinflip);
  //     console.log("Program account data: ", gameResult);

  //     // Log the VRF number
  //     const vrfBigNum = new BN(gameResult.force.slice(0, 8), "le");
  //     const vrfNumber = vrfBigNum.mod(new BN(200)).toNumber();
  //     console.log("VRF number (0-199):", vrfNumber);

  //     // Determine the game outcome based on VRF number
  //     let calculatedOutcome;
  //     if (vrfNumber < 10) {
  //       calculatedOutcome = "Tie";
  //     } else if (vrfNumber < 105) {
  //       calculatedOutcome = "Option1Wins";
  //     } else {
  //       calculatedOutcome = "Option2Wins";
  //     }

  //     console.log("Calculated game outcome:", calculatedOutcome);
  //     console.log("Stored game result:", gameResult.result);
  //     console.log("Player's choice:", gameResult.playerChoice);

  //     // Determine if the player won, lost, or tied
  //     let playerResult;
  //     if (calculatedOutcome === "Tie") {
  //       playerResult = "Tie";
  //     } else if (
  //       (calculatedOutcome === "Option1Wins" &&
  //         gameResult.playerChoice.option1) ||
  //       (calculatedOutcome === "Option2Wins" && gameResult.playerChoice.option2)
  //     ) {
  //       playerResult = "Win";
  //     } else {
  //       playerResult = "Loss";
  //     }

  //     console.log("Player result:", playerResult);
  //     // Log only the house treasury balance after the game
  //     const houseTreasuryBalance = await program.provider.connection.getBalance(
  //       houseTreasury
  //     );
  //     console.log(
  //       "House Treasury balance after game:",
  //       houseTreasuryBalance / LAMPORTS_PER_SOL,
  //       "SOL"
  //     );

  //     // const playerBalance = new BN(
  //     //   await program.provider.connection.getBalance(player.publicKey)
  //     // );
  //     // const houseTreasuryBalance = new BN(
  //     //   await program.provider.connection.getBalance(houseTreasury)
  //     // );
  //     // console.log(
  //     //   "Player balance after game:",
  //     //   playerBalance.div(new BN(LAMPORTS_PER_SOL)).toNumber().toFixed(4),
  //     //   "SOL"
  //     // );
  //     // console.log(
  //     //   "House Treasury balance after game:",
  //     //   houseTreasuryBalance
  //     //     .div(new BN(LAMPORTS_PER_SOL))
  //     //     .toNumber()
  //     //     .toFixed(4),
  //     //   "SOL"
  //     // );

  //     // Verify that the stored result matches the calculated outcome
  //     const storedResultKey = Object.keys(gameResult.result)[0];
  //     assert.equal(
  //       storedResultKey.toLowerCase(),
  //       calculatedOutcome.toLowerCase(),
  //       "Stored result does not match calculated outcome"
  //     );

  //     // Helper function to convert BN to number with 4 decimal places
  //     // const bnToNumber = (bn: BN) =>
  //     //   bn.div(new BN(LAMPORTS_PER_SOL)).toNumber().toFixed(4);

  //     // // Verify that the player result is correct based on their choice and the outcome
  //     // if (playerResult === "Win") {
  //     //   assert(
  //     //     playerBalance.eq(initialPlayerBalance.add(amount)),
  //     //     `Player balance incorrect for win. Expected: ${bnToNumber(
  //     //       initialPlayerBalance.add(amount)
  //     //     )}, Actual: ${bnToNumber(playerBalance)}`
  //     //   );
  //     //   assert(
  //     //     houseTreasuryBalance.eq(initialHouseTreasuryBalance.sub(amount)),
  //     //     `House balance incorrect for player win. Expected: ${bnToNumber(
  //     //       initialHouseTreasuryBalance.sub(amount)
  //     //     )}, Actual: ${bnToNumber(houseTreasuryBalance)}`
  //     //   );
  //     // } else if (playerResult === "Loss") {
  //     //   assert(
  //     //     playerBalance.eq(initialPlayerBalance.sub(amount)),
  //     //     `Player balance incorrect for loss. Expected: ${bnToNumber(
  //     //       initialPlayerBalance.sub(amount)
  //     //     )}, Actual: ${bnToNumber(playerBalance)}`
  //     //   );
  //     //   assert(
  //     //     houseTreasuryBalance.eq(initialHouseTreasuryBalance.add(amount)),
  //     //     `House balance incorrect for player loss. Expected: ${bnToNumber(
  //     //       initialHouseTreasuryBalance.add(amount)
  //     //     )}, Actual: ${bnToNumber(houseTreasuryBalance)}`
  //     //   );
  //     // } else {
  //     //   // Tie
  //     //   assert(
  //     //     playerBalance.eq(initialPlayerBalance),
  //     //     `Player balance should not change for tie. Expected: ${bnToNumber(
  //     //       initialPlayerBalance
  //     //     )}, Actual: ${bnToNumber(playerBalance)}`
  //     //   );
  //     //   assert(
  //     //     houseTreasuryBalance.eq(initialHouseTreasuryBalance),
  //     //     `House balance should not change for tie. Expected: ${bnToNumber(
  //     //       initialHouseTreasuryBalance
  //     //     )}, Actual: ${bnToNumber(houseTreasuryBalance)}`
  //     //   );
  //     // }
  //   } catch (e) {
  //     console.error("Error getting the result:", e);
  //     throw e;
  //   }
  // });
});
