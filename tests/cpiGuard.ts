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
import {
  airdrop,
  fetchAdminKeypair,
  fetchPayerKeypair,
  fetchReceiverKeypair,
  rejectedWith,
  sendAndConfirmTransaction,
} from "./utils";
import Debug from "debug";

const log = Debug("log: cpiGuard");
const warning = Debug("log: ");

describe("✅ token-extension: cpi guard enable", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;
  const opaqueProgram = anchor.workspace.Opaque as Program<Opaque>;

  it("enable cpi guard account", async () => {
    console.log();
    warning("🔧 CPI Guard cannot be enabled or disabled via CPI 🔧");
    console.log();

    const admin = fetchAdminKeypair();

    const payer = fetchPayerKeypair();

    const receiver = fetchReceiverKeypair();

    await airdrop(provider, receiver.publicKey, payer.publicKey);

    const tokenAccount = anchor.web3.Keypair.generate();
    log("TokenAccount", tokenAccount.publicKey.toBase58());

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

    const accountLen = new anchor.BN(getAccountLen([ExtensionType.CpiGuard]));

    const transaction = new anchor.web3.Transaction();

    // with CPI guard
    const enableCpiGuardIx = await program.methods
      .initializeTokenAccountWith(accountLen)
      .accounts({
        mint: mint.publicKey,
        tokenAcc: tokenAccount.publicKey,
        payer: payer.publicKey,
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
      signers: [admin, tokenAccount, payer],
    });
    log("TokenAccount with CPI Guard txId ", txId);

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

    log("Minted to admin tokenAccount txId ", mintTotxId);

    // without cpi guard
    const associatedTokenAcc = await createAssociatedTokenAccountIdempotent(
      provider.connection,
      admin,
      mint.publicKey,
      admin.publicKey,
      { commitment: "finalized", skipPreflight: true },
      TOKEN_2022_PROGRAM_ID
    );

    log("Admin ATA", associatedTokenAcc.toBase58());

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

    log("Minted to admin ATA txId ", mintToAtaId);

    // without cpi guard
    const receiverATA = await createAssociatedTokenAccountIdempotent(
      provider.connection,
      receiver,
      mint.publicKey,
      receiver.publicKey,
      { commitment: "finalized", skipPreflight: true },
      TOKEN_2022_PROGRAM_ID
    );

    log("Receiver ATA without CPI Guard", receiverATA.toBase58());

    const receiverBalBeforeCpi = await provider.connection.getBalance(
      receiver.publicKey,
      "finalized"
    );

    log("Receiver sol balance before CPI transfer", receiverBalBeforeCpi);

    const transferTokenTxId = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: await program.methods
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
        .transaction(),
      signers: [admin],
    });

    log("Transfer token without CPI Guard account txId ", transferTokenTxId);

    const receiverBalAfterCpi = await provider.connection.getBalance(
      receiver.publicKey,
      "finalized"
    );

    log("Receiver sol balance after CPI transfer", receiverBalAfterCpi);

    log("Failed: CPI guard account");

    await rejectedWith(
      sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: await program.methods
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
          .transaction(),
        signers: [admin],
      }),
      Error
    );
  });
});
