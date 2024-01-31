import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenExtension } from "../target/types/token_extension";
import { readFileSync } from "fs";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
} from "@solana/spl-token";
import * as path from "path";

describe("token-extension", () => {
  // Configure the client to use the local cluster.
  // const provider = anchor.AnchorProvider.local("http://127.0.0.1:8899");
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;

  const admin = keypairFromFile(path.join(__dirname, "../keypairs/admin.json"));
  const mint = anchor.web3.Keypair.generate();
  console.log("Mint", mint.publicKey.toBase58());

  it("Is initialized!", async () => {
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

    try {
      const txId = await anchor.web3.sendAndConfirmTransaction(
        provider.connection,
        tx,
        [admin, mint],
        { commitment: "processed" }
      );
      console.log("Your transaction signature", txId);
    } catch (error) {
      console.log("Transaction error", error);
    }
  });
});

export function keypairFromFile(path: string): anchor.web3.Keypair {
  return anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(readFileSync(path).toString("utf-8")) as number[]
    )
  );
}
