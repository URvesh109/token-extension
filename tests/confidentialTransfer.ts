import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenExtension } from "../target/types/token_extension";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
  getAccountLen,
} from "@solana/spl-token";
import * as path from "path";
import { keypairFromFile, sendAndConfirmTransaction, assert } from "./utils";
import Debug from "debug";

const log = Debug("log:confidentialTransfer");

describe("token-extension: confidential transfer", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;

  const admin = keypairFromFile(path.join(__dirname, "../keypairs/admin.json"));
  log("Admin ", admin.publicKey.toBase58());

  const mint = anchor.web3.Keypair.generate();
  log("Mint", mint.publicKey.toBase58());

  const tokenAccount = anchor.web3.Keypair.generate();
  log("TokenAccount", tokenAccount.publicKey.toBase58());

  it("intialize metadata pointer and token metadata", async () => {
    const mintLen = new anchor.BN(
      // getMintLen([ExtensionType.ConfidentialTransferMint]) won't work so hard coded 235 bytes
      235
    );

    const mintTxId = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: await program.methods
        .initializeConfidentialMint(mintLen, 2)
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
    log("Mint initialzed id ", mintTxId);

    const accountLen = new anchor.BN(
      getAccountLen([])
      // getAccountLen([ExtensionType.ConfidentialTransferAccount])
    );

    const accTxId = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: await program.methods
        .initializeConfidentialAccount(accountLen)
        .accounts({
          mint: mint.publicKey,
          tokenAccount: tokenAccount.publicKey,
          payer: admin.publicKey,
          owner: admin.publicKey,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .transaction(),
      signers: [admin, tokenAccount],
    });
    log("TokenAccount initialized id ", accTxId);
  });
});
