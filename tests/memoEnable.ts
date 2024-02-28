import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenExtension } from "../target/types/token_extension";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  createAssociatedTokenAccountIdempotent,
  mintTo,
  createMint,
  getAccountLen,
} from "@solana/spl-token";
import {
  sendAndConfirmTransaction,
  MEMO_PROGRAM_ID,
  fetchAdminKeypair,
  fetchReceiverKeypair,
} from "./utils";
import Debug from "debug";

const log = Debug("log: memoEnable");

describe("✅ token-extension: memo enable transfer", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;

  it("enable memo transfer account", async () => {
    const admin = fetchAdminKeypair();

    const receiver = fetchReceiverKeypair();

    const receiverAcc = anchor.web3.Keypair.generate();
    log("Receiver account", receiverAcc.publicKey.toBase58());

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
    log("Mint ", mintPub.toBase58());

    const associatedTokenAcc = await createAssociatedTokenAccountIdempotent(
      provider.connection,
      admin,
      mint.publicKey,
      admin.publicKey,
      { commitment: "finalized", skipPreflight: true },
      TOKEN_2022_PROGRAM_ID
    );

    log("Admin ATA ", associatedTokenAcc.toBase58());

    const txId = await mintTo(
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

    log("Minted to admin ATA txId ", txId);

    const accountLen = new anchor.BN(
      getAccountLen([ExtensionType.MemoTransfer])
    );

    const memoId = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: await program.methods
        .enableMemo(accountLen)
        .accounts({
          mint: mint.publicKey,
          receiverAcc: receiverAcc.publicKey,
          payer: admin.publicKey,
          receiver: receiver.publicKey,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .transaction(),
      signers: [admin, receiver, receiverAcc],
    });

    log("Memo enable tx id ", memoId);

    const mTid = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: await program.methods
        .memoTransfer(new anchor.BN(5 * 10 ** decimals), decimals)
        .accounts({
          mint: mint.publicKey,
          fromAcc: associatedTokenAcc,
          toAcc: receiverAcc.publicKey,
          authority: admin.publicKey,
          memoProgram: MEMO_PROGRAM_ID,
          token2022Program: TOKEN_2022_PROGRAM_ID,
        })
        .transaction(),
      signers: [admin],
    });

    log("Memo transfer tx id ", mTid);
  });
});
