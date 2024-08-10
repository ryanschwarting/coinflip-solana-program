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
  // Configure the client to use devnet
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

  // Use Orao devnet configuration
  const vrf = new Orao(program.provider as any);
  const networkState = networkStateAccountAddress(); // This should return the devnet address
  let force: Uint8Array;

  // Create a house treasury account
  const houseTreasury = Keypair.generate();

  before(async () => {
    // Fund the player's wallet if needed
    const balance = await provider.connection.getBalance(player.publicKey);
    if (balance < LAMPORTS_PER_SOL) {
      const signature = await provider.connection.requestAirdrop(
        player.publicKey,
        LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(signature);
    }
  });

  it("Initialize house treasury", async () => {
    const tx = await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        SystemProgram.transfer({
          fromPubkey: player.publicKey,
          toPubkey: houseTreasury.publicKey,
          lamports: LAMPORTS_PER_SOL,
        })
      )
    );
    console.log("House treasury initialized");
    console.log("Using wallet pubkey:", provider.wallet.publicKey.toString());
  });

  it("Create coinflip game", async () => {
    const tx = await program.methods
      .createCoinflip(room_id, amount)
      .accounts({
        player: player.publicKey,
        coinflip,
        // houseTreasury: houseTreasury.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Your transaction signature", tx);
    console.log(
      "Program account data: ",
      await program.account.coinflip.fetch(coinflip)
    );
  });

  it("Play the game", async () => {
    force = Keypair.generate().secretKey.slice(0, 32);
    const random = randomnessAccountAddress(force);

    const tx = await program.methods
      .playCoinflip(room_id, Array.from(force))
      .accounts({
        player: player.publicKey,
        coinflip: coinflip,
        // houseTreasury: houseTreasury.publicKey,
        vrf: vrf.programId,
        config: networkState,
        random,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log(`Game has started, randomness is requested: `, tx);
  });

  it("Randomness fulfilled", async () => {
    let randomnessFulfilled = await vrf.waitFulfilled(force);
    console.log("Randomness is fulfilled, we can call the result function");
  });

  it("Get the result", async () => {
    const random = randomnessAccountAddress(force);

    const tx = await program.methods
      .resultCoinflip(room_id, Array.from(force))
      .accounts({
        player: player.publicKey,
        coinflip: coinflip,
        houseTreasury: houseTreasury.publicKey,
        vrf: vrf.programId,
        config: networkState,
        random,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log(`Game is finished`, tx);
    const gameResult = await program.account.coinflip.fetch(coinflip);
    console.log("Program account data: ", gameResult);
  });
});
