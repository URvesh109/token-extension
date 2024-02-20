import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenExtension } from "../target/types/token_extension";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  createMint,
  getAccountLen,
  createEnableCpiGuardInstruction,
} from "@solana/spl-token";
import * as path from "path";
import { keypairFromFile, sendAndConfirmTransaction } from "./utils";
import Debug from "debug";

const log = Debug("log:cpiGuard");

log("CPI Guard cannot be enabled or disabled via CPI.");

describe("token-extension: cpi guard enable", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;

  const admin = keypairFromFile(path.join(__dirname, "../keypairs/admin.json"));

  it("enable cpi guard account", async () => {
    const tokenAccount = anchor.web3.Keypair.generate();
    log("tokenAccount", tokenAccount.publicKey.toBase58());

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

    const accountLen = new anchor.BN(getAccountLen([ExtensionType.CpiGuard]));

    const transaction = new anchor.web3.Transaction();

    const enableCpiGuardIx = await program.methods
      .initializeWithCpiGuard(accountLen)
      .accounts({
        mint: mint.publicKey,
        tokenAcc: tokenAccount.publicKey,
        payer: admin.publicKey,
        wallet: admin.publicKey,
        token2022Program: TOKEN_2022_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    transaction.add(enableCpiGuardIx);

    transaction.add(
      createEnableCpiGuardInstruction(
        tokenAccount.publicKey,
        admin.publicKey,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );

    const txId = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction,
      signers: [admin, tokenAccount],
    });
    log("cpi guarded txId ", txId);
  });
});
