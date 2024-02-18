import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenExtension } from "../target/types/token_extension";
import {
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotent,
  createMint,
} from "@solana/spl-token";
import * as path from "path";
import { keypairFromFile, log, sendAndConfirmTransaction } from "./utils";

describe("token-extension: realloc usage", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;

  const admin = keypairFromFile(path.join(__dirname, "../keypairs/admin.json"));

  it("realloc token account with memo transfer enable", async () => {
    const mint = anchor.web3.Keypair.generate();
    log("Mint", mint.publicKey.toBase58());

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
    log("Mint created ", mintPub.toBase58());

    const associatedTokenAcc = await createAssociatedTokenAccountIdempotent(
      provider.connection,
      admin,
      mint.publicKey,
      admin.publicKey,
      { commitment: "finalized", skipPreflight: true },
      TOKEN_2022_PROGRAM_ID
    );

    log("Admin ATA created ", associatedTokenAcc.toBase58());

    const reallocTx = await program.methods
      .realloc()
      .accounts({
        tokenAccount: associatedTokenAcc,
        payer: admin.publicKey,
        allMintRole: admin.publicKey,
        token2022Program: TOKEN_2022_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .transaction();

    const rTid = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: reallocTx,
      signers: [admin],
    });

    log("Realloc tx id ", rTid);
  });
});
