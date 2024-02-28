import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenExtension } from "../target/types/token_extension";
import { TransferHook } from "../target/types/transfer_hook";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
  mintTo,
  createAssociatedTokenAccountIdempotent,
} from "@solana/spl-token";
import {
  airdrop,
  fetchAdminKeypair,
  fetchPayerKeypair,
  fetchReceiverKeypair,
  sendAndConfirmTransaction,
} from "./utils";
import Debug from "debug";

const log = Debug("log: transferHook");

describe("✅ token-extension: transfer hook", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;
  const transferHookProgram = anchor.workspace
    .TransferHook as Program<TransferHook>;

  it("intialize transfer hook mint", async () => {
    const admin = fetchAdminKeypair();

    const receiver = fetchReceiverKeypair();

    const payer = fetchPayerKeypair();

    await airdrop(provider, receiver.publicKey, payer.publicKey);

    const mint = anchor.web3.Keypair.generate();
    log("Mint", mint.publicKey.toBase58());

    // ExtraAccountMetaList address
    // Store extra accounts required by the custom transfer hook instruction
    const [extraAccountMetaListPDA] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("extra-account-metas"), mint.publicKey.toBuffer()],
        transferHookProgram.programId
      );
    log("extraAccountMetaListPDA", extraAccountMetaListPDA.toBase58());

    const decimals = 2;

    const mintLen = new anchor.BN(getMintLen([ExtensionType.TransferHook]));

    const txId = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: await program.methods
        .initializeHookMint(mintLen, transferHookProgram.programId)
        .accounts({
          mint: mint.publicKey,
          payer: payer.publicKey,
          allMintRole: admin.publicKey,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .transaction(),
      signers: [admin, mint, payer],
    });
    log("Mint hook initialized txId ", txId);

    const transExtraTxId = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: await transferHookProgram.methods
        .initializeExtraAccountMetaList()
        .accounts({
          mint: mint.publicKey,
          extraAccountMetaList: extraAccountMetaListPDA,
        })
        .transaction(),
      signers: [admin],
    });

    log("ExtraAccountMetaList txId ", transExtraTxId);

    const associatedTokenAcc = await createAssociatedTokenAccountIdempotent(
      provider.connection,
      admin,
      mint.publicKey,
      admin.publicKey,
      { commitment: "finalized", skipPreflight: true },
      TOKEN_2022_PROGRAM_ID
    );

    log("Admin ATA initialized ", associatedTokenAcc.toBase58());

    const receiverATA = await createAssociatedTokenAccountIdempotent(
      provider.connection,
      receiver,
      mint.publicKey,
      receiver.publicKey,
      { commitment: "finalized", skipPreflight: true },
      TOKEN_2022_PROGRAM_ID
    );

    log("Receiver ATA initialized ", receiverATA.toBase58());

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

    const transferTokenTxId = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: await program.methods
        .transferHookToken(new anchor.BN(2 * 10 ** decimals), decimals)
        .accounts({
          mint: mint.publicKey,
          fromAcc: associatedTokenAcc,
          toAcc: receiverATA,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          authority: admin.publicKey,
        })
        .remainingAccounts([
          {
            pubkey: extraAccountMetaListPDA,
            isSigner: false,
            isWritable: false,
          },
          {
            pubkey: transferHookProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ])
        .transaction(),
      signers: [admin],
    });

    log("Transfer token txId ", transferTokenTxId);
  });
});
