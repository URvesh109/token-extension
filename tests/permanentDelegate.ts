import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenExtension } from "../target/types/token_extension";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddress,
  getMintLen,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import {
  airdrop,
  expect,
  fetchAdminKeypair,
  fetchReceiverKeypair,
  sendAndConfirmTransaction,
} from "./utils";
import Debug from "debug";

const log = Debug("log: permanentDelegate");

describe("✅ token-extension: permanent delegate usage", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;

  it("initialize mint with permanent delegate, transfer to and burn receiver token using delegate authority", async () => {
    const admin = fetchAdminKeypair();

    const receiver = fetchReceiverKeypair();

    const mint = anchor.web3.Keypair.generate();
    log("Mint", mint.publicKey.toBase58());

    await airdrop(provider, receiver.publicKey);

    const mintLen = new anchor.BN(
      getMintLen([ExtensionType.PermanentDelegate])
    );

    const pTxId = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: await program.methods
        .permanentDelegate(mintLen)
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

    log("Mint initialized with permanent delegate 👇\ntxId", pTxId);

    const associatedTA = await getAssociatedTokenAddress(
      mint.publicKey,
      admin.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const ataId = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: await program.methods
        .createAta()
        .accounts({
          mint: mint.publicKey,
          payer: admin.publicKey,
          associatedToken: associatedTA,
          wallet: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          associatedProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .transaction(),
      signers: [admin],
    });

    log("Admin ATA", associatedTA.toBase58());

    const receiverATA = await getAssociatedTokenAddress(
      mint.publicKey,
      receiver.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const recTxId = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: await program.methods
        .createAta()
        .accounts({
          mint: mint.publicKey,
          payer: receiver.publicKey,
          associatedToken: receiverATA,
          wallet: receiver.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          associatedProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .transaction(),
      signers: [receiver],
    });

    log("Receiver ATA ", receiverATA.toBase58());

    const mintToRecAtaId = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: await program.methods
        .mintTo(new anchor.BN(100))
        .accounts({
          mint: mint.publicKey,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          associatedToken: associatedTA,
          authority: admin.publicKey,
        })
        .transaction(),
      signers: [admin],
    });

    log("Minted to admin ATA 👇\ntxId", mintToRecAtaId);

    const transTxId = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: await program.methods
        .transferTo(new anchor.BN(50), new anchor.BN(0))
        .accounts({
          mint: mint.publicKey,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          fromAcc: associatedTA,
          toAcc: receiverATA,
          authority: admin.publicKey,
        })
        .transaction(),
      signers: [admin],
    });

    log("Transfer from admin to receiver ATA 👇\ntxId", transTxId);

    const burnTxId = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: await program.methods
        .burnCpi(new anchor.BN(10))
        .accounts({
          mint: mint.publicKey,
          from: receiverATA,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          delegate: admin.publicKey, // burned by delegate authority instead of owner.
        })
        .transaction(),
      signers: [admin],
    });
    log("Burned by delegate authority instead of owner 👇\ntxId", burnTxId);

    const receiverAtaAfter = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin,
      mint.publicKey,
      receiver.publicKey,
      false,
      "finalized",
      { skipPreflight: true, commitment: "finalized" },
      TOKEN_2022_PROGRAM_ID
    );
    expect(receiverAtaAfter.amount).to.equal(BigInt(40));
  });
});
