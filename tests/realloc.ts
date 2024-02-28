import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenExtension } from "../target/types/token_extension";
import {
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotent,
  createMint,
} from "@solana/spl-token";
import {
  airdrop,
  fetchAdminKeypair,
  fetchPayerKeypair,
  sendAndConfirmTransaction,
} from "./utils";
import Debug from "debug";

const log = Debug("log: realloc");

describe("✅ token-extension: realloc usage", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;

  it("realloc token account with memo transfer enable", async () => {
    const admin = fetchAdminKeypair();

    const payer = fetchPayerKeypair();

    await airdrop(provider, payer.publicKey);

    const mint = anchor.web3.Keypair.generate();

    const decimals = 2;

    const mintPub = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      admin.publicKey,
      decimals,
      mint,
      { commitment: "finalized", skipPreflight: true },
      TOKEN_2022_PROGRAM_ID
    );
    log("Mint initialized ", mintPub.toBase58());

    const associatedTokenAcc = await createAssociatedTokenAccountIdempotent(
      provider.connection,
      admin,
      mint.publicKey,
      admin.publicKey,
      { commitment: "finalized", skipPreflight: true },
      TOKEN_2022_PROGRAM_ID
    );

    log("Admin ATA initialized ", associatedTokenAcc.toBase58());

    const rTid = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: await program.methods
        .realloc()
        .accounts({
          tokenAccount: associatedTokenAcc,
          payer: payer.publicKey,
          allMintRole: admin.publicKey,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .transaction(),
      signers: [admin, payer],
    });

    log("Realloc txId ", rTid);
  });
});
