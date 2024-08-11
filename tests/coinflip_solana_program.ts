// import * as anchor from "@project-serum/anchor";
// import { Program } from "@project-serum/anchor";
// import { SolanaCoinflipGame } from "../target/types/solana_coinflip_game";
// import {
//   Keypair,
//   LAMPORTS_PER_SOL,
//   PublicKey,
//   SystemProgram,
// } from "@solana/web3.js";
// import { BN } from "bn.js";
// import {
//   networkStateAccountAddress,
//   Orao,
//   randomnessAccountAddress,
// } from "@orao-network/solana-vrf";

// describe("solana-coinflip-game", () => {
//   const provider = anchor.AnchorProvider.env();
//   anchor.setProvider(provider);

//   const program = anchor.workspace
//     .SolanaCoinflipGame as Program<SolanaCoinflipGame>;
//   const player = provider.wallet;

//   const room_id = "test_room_" + Math.random().toString(36).substring(7);
//   const amount = new BN(LAMPORTS_PER_SOL * 0.1);
//   const [coinflip] = PublicKey.findProgramAddressSync(
//     [Buffer.from("coinflip"), Buffer.from(room_id)],
//     program.programId
//   );
//   const [houseTreasury] = PublicKey.findProgramAddressSync(
//     [Buffer.from("house_treasury")],
//     program.programId
//   );

//   console.log("House Treasury PDA address:", houseTreasury.toBase58());

//   const vrf = new Orao(program.provider as any);
//   const networkState = networkStateAccountAddress();
//   let force: Uint8Array;

//   // before(async () => {
//   //   const balance = await provider.connection.getBalance(player.publicKey);
//   //   if (balance < LAMPORTS_PER_SOL * 5) {
//   //     const signature = await provider.connection.requestAirdrop(
//   //       player.publicKey,
//   //       LAMPORTS_PER_SOL * 5
//   //     );
//   //     await provider.connection.confirmTransaction(signature);
//   //   }
//   // });

//   it("Initialize house treasury", async () => {
//     const tx = await program.methods
//       .initializeHouse()
//       .accounts({
//         houseTreasury,
//         authority: player.publicKey,
//         systemProgram: SystemProgram.programId,
//       })
//       .rpc();
//     console.log("House treasury initialized");
//   });

//   it("Fund house treasury", async () => {
//     try {
//       const tx = await program.methods
//         .fundTreasury(new BN(LAMPORTS_PER_SOL * 0.5))
//         .accounts({
//           funder: player.publicKey,
//           houseTreasury,
//           systemProgram: SystemProgram.programId,
//         })
//         .rpc();
//       console.log("House treasury funded");
//     } catch (e) {
//       console.error("Error funding house treasury:", e);
//       throw e; // rethrow the error to fail the test
//     }
//   });

//   it("Create coinflip game", async () => {
//     try {
//       const tx = await program.methods
//         .createCoinflip(room_id, amount)
//         .accounts({
//           player: player.publicKey,
//           coinflip,
//           houseTreasury,
//           systemProgram: SystemProgram.programId,
//         })
//         .rpc();
//       console.log("Coinflip game created, tx:", tx);
//     } catch (e) {
//       console.error("Error creating coinflip game:", e);
//       throw e;
//     }
//   });

//   it("Play the game", async () => {
//     try {
//       const force = new Uint8Array(32);
//       crypto.getRandomValues(force);
//       const random = randomnessAccountAddress(Buffer.from(force));

//       const tx = await program.methods
//         .playCoinflip(room_id, Array.from(force))
//         .accounts({
//           player: player.publicKey,
//           coinflip: coinflip,
//           houseTreasury: houseTreasury,
//           vrf: vrf.programId,
//           config: networkState,
//           random,
//           systemProgram: SystemProgram.programId,
//         })
//         .rpc();

//       console.log(`Game has started, randomness is requested: `, tx);
//     } catch (e) {
//       console.error("Error playing the game:", e);
//       throw e;
//     }
//   });

//   it("Get the result", async () => {
//     try {
//       const tx = await program.methods
//         .resultCoinflip(room_id, Array.from(force))
//         .accounts({
//           player: player.publicKey,
//           coinflip: coinflip,
//           houseTreasury: houseTreasury,
//           vrf: vrf.programId,
//           config: networkState,
//           random: randomnessAccountAddress(Buffer.from(force)),
//           systemProgram: SystemProgram.programId,
//         })
//         .rpc();

//       console.log(`Game is finished`, tx);
//       const gameResult = await program.account.coinflip.fetch(coinflip);
//       console.log("Program account data: ", gameResult);
//     } catch (e) {
//       console.error("Error getting the result:", e);
//       throw e;
//     }
//   });

//   // it("Withdraw house funds", async () => {
//   //   const tx = await program.methods
//   //     .withdrawHouseFunds(new BN(LAMPORTS_PER_SOL * 0.1))
//   //     .accounts({
//   //       authority: player.publicKey,
//   //       houseTreasury,
//   //       systemProgram: SystemProgram.programId,
//   //     })
//   //     .rpc();
//   //   console.log("Funds withdrawn from house treasury");
//   // });
// });

import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SolanaCoinflipGame } from "../target/types/solana_coinflip_game";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { BN } from "bn.js";
import {
  networkStateAccountAddress,
  Orao,
  randomnessAccountAddress,
} from "@orao-network/solana-vrf";

describe("solana-coinflip-game", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .SolanaCoinflipGame as Program<SolanaCoinflipGame>;
  const player = provider.wallet;

  const room_id = "test_room_" + Math.random().toString(36).substring(7);
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

  const vrf = new Orao(program.provider as any);
  const networkState = networkStateAccountAddress();
  let force: Uint8Array;
  let oraoTreasury: PublicKey;

  // before(async () => {
  //   oraoTreasury = await vrf.provider.publicKey;
  //   console.log("Orao Treasury address:", oraoTreasury.toBase58());
  // });

  it("Initialize house treasury", async () => {
    try {
      const tx = await program.methods
        .initializeHouse()
        .accounts({
          houseTreasury,
          authority: player.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log("House treasury initialized");
    } catch (e) {
      console.log("House treasury already initialized or error:", e);
    }
  });

  it("Fund house treasury", async () => {
    try {
      const tx = await program.methods
        .fundTreasury(new BN(LAMPORTS_PER_SOL * 0.5))
        .accounts({
          funder: player.publicKey,
          houseTreasury,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log("House treasury funded");
    } catch (e) {
      console.error("Error funding house treasury:", e);
      throw e;
    }
  });

  it("Create coinflip game", async () => {
    try {
      const tx = await program.methods
        .createCoinflip(room_id, amount)
        .accounts({
          player: player.publicKey,
          coinflip,
          houseTreasury,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log("Coinflip game created, tx:", tx);
    } catch (e) {
      console.error("Error creating coinflip game:", e);
      throw e;
    }
  });

  it("Play the game", async () => {
    try {
      force = new Uint8Array(32);
      crypto.getRandomValues(force);
      const random = randomnessAccountAddress(Buffer.from(force));

      const tx = await program.methods
        .playCoinflip(room_id, Array.from(force))
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
    } catch (e) {
      console.error("Error playing the game:", e);
      throw e;
    }
  });

  it("Get the result", async () => {
    try {
      const tx = await program.methods
        .resultCoinflip(room_id, Array.from(force))
        .accounts({
          player: player.publicKey,
          coinflip: coinflip,
          houseTreasury: houseTreasury,
          oraoTreasury: oraoTreasury,
          vrf: vrf.programId,
          config: networkState,
          random: randomnessAccountAddress(Buffer.from(force)),
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log(`Game is finished`, tx);
      const gameResult = await program.account.coinflip.fetch(coinflip);
      console.log("Program account data: ", gameResult);
    } catch (e) {
      console.error("Error getting the result:", e);
      throw e;
    }
  });
});
