import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenExtension } from "../target/types/token_extension";
import { Opaque } from "./../target/types/opaque";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  createMint,
  getAccountLen,
  createEnableCpiGuardInstruction,
  mintTo,
  createAssociatedTokenAccountIdempotent,
} from "@solana/spl-token";
import * as path from "path";
import {
  airdrop,
  keypairFromFile,
  rejectedWith,
  sendAndConfirmTransaction,
} from "./utils";
import Debug from "debug";

const log = Debug("log:cpiGuard");

log("CPI Guard cannot be enabled or disabled via CPI.");

describe("token-extension: cpi guard enable", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;
  const opaqueProgram = anchor.workspace.Opaque as Program<Opaque>;

  const admin = keypairFromFile(path.join(__dirname, "../keypairs/admin.json"));
  const receiver = keypairFromFile(
    path.join(__dirname, "../keypairs/receiver.json")
  );

  it("enable cpi guard account", async () => {
    await airdrop(provider, receiver.publicKey);

    const tokenAccount = anchor.web3.Keypair.generate();
    log("TokenAccount", tokenAccount.publicKey.toBase58());

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
    log("Cpi guarded txId ", txId);

    const mintTotxId = await mintTo(
      provider.connection,
      admin,
      mint.publicKey,
      tokenAccount.publicKey,
      admin.publicKey,
      20 * 10 ** decimals,
      [],
      { commitment: "finalized", skipPreflight: true },
      TOKEN_2022_PROGRAM_ID
    );

    log("Minted to admin token acc txId ", mintTotxId);

    // without cpi guard
    const associatedTokenAcc = await createAssociatedTokenAccountIdempotent(
      provider.connection,
      admin,
      mint.publicKey,
      admin.publicKey,
      { commitment: "finalized", skipPreflight: true },
      TOKEN_2022_PROGRAM_ID
    );

    log("Admin ATA created ", associatedTokenAcc.toBase58());

    const mintToAtaId = await mintTo(
      provider.connection,
      admin,
      mint.publicKey,
      associatedTokenAcc,
      admin.publicKey,
      20 * 10 ** decimals,
      [],
      { commitment: "finalized", skipPreflight: true },
      TOKEN_2022_PROGRAM_ID
    );

    log("Minted to admint ATA txId ", mintToAtaId);

    // without cpi guard
    const receiverATA = await createAssociatedTokenAccountIdempotent(
      provider.connection,
      receiver,
      mint.publicKey,
      receiver.publicKey,
      { commitment: "finalized", skipPreflight: true },
      TOKEN_2022_PROGRAM_ID
    );

    log("Receiver ATA created ", receiverATA.toBase58());

    const receiverBalBeforeCpi = await provider.connection.getBalance(
      receiver.publicKey,
      "finalized"
    );

    log("Receiver sol balance before cpi ", receiverBalBeforeCpi);

    const transferTokenTx = await program.methods
      .transferToken(new anchor.BN(2 * 10 ** decimals), decimals)
      .accounts({
        mint: mint.publicKey,
        fromAcc: associatedTokenAcc,
        toAcc: receiverATA,
        token2022Program: TOKEN_2022_PROGRAM_ID,
        authority: admin.publicKey,
        opaque: opaqueProgram.programId,
        systemProgram: anchor.web3.SystemProgram.programId,
        badWallet: receiver.publicKey,
      })
      .transaction();

    const transferTokenTxId = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: transferTokenTx,
      signers: [admin],
    });

    log("Transfer token without CPI GUARD txId ", transferTokenTxId);

    const receiverBalAfterCpi = await provider.connection.getBalance(
      receiver.publicKey,
      "finalized"
    );

    log("Receiver sol balance after cpi ", receiverBalAfterCpi);

    log("Failed: Transfer token with CPI GUARD");

    const transferTokenCpiGuardTx = await program.methods
      .transferToken(new anchor.BN(2 * 10 ** decimals), decimals)
      .accounts({
        mint: mint.publicKey,
        fromAcc: tokenAccount.publicKey,
        toAcc: receiverATA,
        token2022Program: TOKEN_2022_PROGRAM_ID,
        authority: admin.publicKey,
        opaque: opaqueProgram.programId,
        systemProgram: anchor.web3.SystemProgram.programId,
        badWallet: receiver.publicKey,
      })
      .transaction();

    await rejectedWith(
      sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: transferTokenCpiGuardTx,
        signers: [admin],
      }),
      Error
    );
  });
});
