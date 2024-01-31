import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenExtension } from "../target/types/token_extension";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
} from "@solana/spl-token";
import * as path from "path";
import { keypairFromFile, runTest, sendAndConfirmTransaction } from "./utils";

describe("token-extension", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;

  const admin = keypairFromFile(path.join(__dirname, "../keypairs/admin.json"));
  const mint = anchor.web3.Keypair.generate();
  console.log("Mint", mint.publicKey.toBase58());

  it(
    "Is initialized!",
    runTest(async () => {
      // Add your test here.
      const tx = await program.methods
        .mintCloseAuthority(
          new anchor.BN(getMintLen([ExtensionType.MintCloseAuthority]))
        )
        .accounts({
          mint: mint.publicKey,
          payer: admin.publicKey,
          allMintRole: admin.publicKey,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .transaction();

      const txId = await sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: tx,
        signers: [admin, mint],
      });
      console.log("Transaction id", txId);
    })
  );
});
