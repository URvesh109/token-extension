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
import * as path from "path";
import {
  airdrop,
  expect,
  keypairFromFile,
  log,
  sendAndConfirmTransaction,
} from "./utils";

describe("token-extension: permanent delegate usage", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;

  const admin = keypairFromFile(path.join(__dirname, "../keypairs/admin.json"));
  log("Admin", admin.publicKey.toBase58());

  const receiver = keypairFromFile(
    path.join(__dirname, "../keypairs/receiver.json")
  );
  log("Receiver", receiver.publicKey.toBase58());

  const mint = anchor.web3.Keypair.generate();
  log("Mint", mint.publicKey.toBase58());

  it("initialize mint with permanent delegate, transfer to and burn receiver token using delegate authority", async () => {
    await airdrop(provider, receiver.publicKey);

    const mintLen = new anchor.BN(
      getMintLen([ExtensionType.PermanentDelegate])
    );

    const permanentTx = await program.methods
      .permanentDelegate(mintLen)
      .accounts({
        mint: mint.publicKey,
        payer: admin.publicKey,
        allMintRole: admin.publicKey,
        token2022Program: TOKEN_2022_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .transaction();

    const pTxId = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: permanentTx,
      signers: [admin, mint],
    });

    log("Mint initialized with permanent delegate 👇\ntxId", pTxId);

    const associatedTA = await getAssociatedTokenAddress(
      mint.publicKey,
      admin.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    log("Admin ata 👇", associatedTA.toBase58());

    const ataTx = await program.methods
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
      .transaction();

    const ataId = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: ataTx,
      signers: [admin],
    });

    log("txId", ataId);

    const receiverATA = await getAssociatedTokenAddress(
      mint.publicKey,
      receiver.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );
    log("Receiver ata 👇", receiverATA.toBase58());

    const recAtaTx = await program.methods
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
      .transaction();

    const rAtaIdawait = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: recAtaTx,
      signers: [receiver],
    });

    log("txId", rAtaIdawait);

    const mintToAdminAtaTx = await program.methods
      .mintTo(new anchor.BN(100))
      .accounts({
        mint: mint.publicKey,
        token2022Program: TOKEN_2022_PROGRAM_ID,
        associatedToken: associatedTA,
        authority: admin.publicKey,
      })
      .transaction();

    const mintToRecAtaId = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: mintToAdminAtaTx,
      signers: [admin],
    });

    log("Minted to admin ata 👇\ntxId", mintToRecAtaId);

    const transferTx = await program.methods
      .transferTo(new anchor.BN(50), new anchor.BN(0))
      .accounts({
        mint: mint.publicKey,
        token2022Program: TOKEN_2022_PROGRAM_ID,
        fromAcc: associatedTA,
        toAcc: receiverATA,
        authority: admin.publicKey,
      })
      .transaction();

    const transTxId = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: transferTx,
      signers: [admin],
    });

    log("Transfer token from admin to receiver ata 👇\ntxId", transTxId);

    const burnTx = await program.methods
      .burnCpi(new anchor.BN(10))
      .accounts({
        mint: mint.publicKey,
        from: receiverATA,
        token2022Program: TOKEN_2022_PROGRAM_ID,
        delegate: admin.publicKey, // burned by delegate authority instead of owner.
      })
      .transaction();

    const burnTxId = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: burnTx,
      signers: [admin],
    });
    log("Burn txId", burnTxId);

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
