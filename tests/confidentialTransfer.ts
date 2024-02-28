import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenExtension } from "../target/types/token_extension";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getAccountLen,
} from "@solana/spl-token";
import { sendAndConfirmTransaction, fetchAdminKeypair } from "./utils";
import Debug from "debug";

const log = Debug("log: confidentialTransfer");

describe("🚧🚧 token-extension: confidential transfer work in progress 🚧🚧", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;

  it("intialize confidential", async () => {
    const admin = fetchAdminKeypair();

    const mint = anchor.web3.Keypair.generate();
    log("Mint", mint.publicKey.toBase58());

    const tokenAccount = anchor.web3.Keypair.generate();
    log("TokenAccount", tokenAccount.publicKey.toBase58());

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
    log("Mint initialized id ", mintTxId);

    const accountLen = new anchor.BN(
      getAccountLen([ExtensionType.ConfidentialTransferAccount])
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
