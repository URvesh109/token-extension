import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenExtension } from "../target/types/token_extension";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
} from "@solana/spl-token";
import * as path from "path";
import { keypairFromFile, sendAndConfirmTransaction } from "./utils";
import Debug from "debug";

const log = Debug("log:metadaPointer");

describe("token-extension: metadata pointer", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;

  const admin = keypairFromFile(path.join(__dirname, "../keypairs/admin.json"));

  const mint = anchor.web3.Keypair.generate();
  log("Mint", mint.publicKey.toBase58());

  it("intialize metadata pointer mint", async () => {
    const mintLen = new anchor.BN(getMintLen([ExtensionType.MetadataPointer]));

    const txId = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: await program.methods
        .initializeMetadataPointer(mintLen, 2)
        .accounts({
          mint: mint.publicKey,
          payer: admin.publicKey,
          allMintRole: admin.publicKey,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .transaction(),
      signers: [admin, mint],
    });
    log("Mint hook initialized txId ", txId);
  });
});
