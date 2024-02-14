import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenExtension } from "../target/types/token_extension";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
  createAssociatedTokenAccountIdempotent,
  mintTo,
  createMint,
  getAccountLen,
} from "@solana/spl-token";
import * as path from "path";
import {
  keypairFromFile,
  log,
  sendAndConfirmTransaction,
  MEMO_PROGRAM_ID,
} from "./utils";

describe("token-extension: memo enable transfer", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;

  const admin = keypairFromFile(path.join(__dirname, "../keypairs/admin.json"));

  const receiver = keypairFromFile(
    path.join(__dirname, "../keypairs/receiver.json")
  );

  it("enable memo transfer account", async () => {
    const receiverAcc = anchor.web3.Keypair.generate();
    log("Receiver acc", receiverAcc.publicKey.toBase58());

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

    const associatedTokenAcc = await createAssociatedTokenAccountIdempotent(
      provider.connection,
      admin,
      mint.publicKey,
      admin.publicKey,
      { commitment: "finalized", skipPreflight: true },
      TOKEN_2022_PROGRAM_ID
    );

    log("Admin ATA created ", associatedTokenAcc.toBase58());

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

    log("Minted to txId ", txId);

    const accountLen = new anchor.BN(
      getAccountLen([ExtensionType.MemoTransfer])
    );

    const enableMemoTx = await program.methods
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
      .transaction();

    const memoId = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: enableMemoTx,
      signers: [admin, receiver, receiverAcc],
    });

    log("Memo enable tx id ", memoId);

    const memoTransferTx = await program.methods
      .memoTransfer(new anchor.BN(5 * 10 ** decimals), decimals)
      .accounts({
        mint: mint.publicKey,
        fromAcc: associatedTokenAcc,
        toAcc: receiverAcc.publicKey,
        authority: admin.publicKey,
        memoProgram: MEMO_PROGRAM_ID,
        token2022Program: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    const mTid = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: memoTransferTx,
      signers: [admin],
    });

    log("Memo transfer tx id ", mTid);
  });
});
