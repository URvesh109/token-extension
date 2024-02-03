import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenExtension } from "../target/types/token_extension";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
  createAssociatedTokenAccountIdempotent,
} from "@solana/spl-token";
import * as path from "path";
import { keypairFromFile, runTest, sendAndConfirmTransaction } from "./utils";

describe("token-extension transfer-fee", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;

  const admin = keypairFromFile(path.join(__dirname, "../keypairs/admin.json"));
  const receiver = keypairFromFile(
    path.join(__dirname, "../keypairs/receiver.json")
  );
  const mint = anchor.web3.Keypair.generate();
  console.log("Mint", mint.publicKey.toBase58());

  it(
    "Set transferFeeConfig",
    runTest(async () => {
      const feeBasisPoint = 50;
      const tx = await program.methods
        .transferFeeConfig(
          new anchor.BN(getMintLen([ExtensionType.TransferFeeConfig])),
          admin.publicKey,
          admin.publicKey,
          feeBasisPoint,
          new anchor.BN(100).mul(new anchor.BN(10).pow(new anchor.BN(2)))
        )
        .accounts({
          mint: mint.publicKey,
          payer: admin.publicKey,
          allMintRole: admin.publicKey,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .transaction();

      await sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: tx,
        signers: [admin, mint],
      });

      const associatedTokenAcc = await createAssociatedTokenAccountIdempotent(
        provider.connection,
        admin,
        mint.publicKey,
        admin.publicKey,
        { commitment: "processed" },
        TOKEN_2022_PROGRAM_ID
      );

      console.log("Associated ", associatedTokenAcc.toBase58());

      const mintTx = await program.methods
        .mintTo(
          new anchor.BN(1000).mul(new anchor.BN(10).pow(new anchor.BN(2)))
        )
        .accounts({
          mint: mint.publicKey,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          associatedToken: associatedTokenAcc,
          authority: admin.publicKey,
        })
        .transaction();

      await sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: mintTx,
        signers: [admin],
      });

      const receiverAssociatedTokenAcc =
        await createAssociatedTokenAccountIdempotent(
          provider.connection,
          admin,
          mint.publicKey,
          receiver.publicKey,
          { commitment: "processed" },
          TOKEN_2022_PROGRAM_ID
        );

      console.log(
        "receiverAssociatedTokenAcc ",
        receiverAssociatedTokenAcc.toBase58()
      );

      const transferAmount = new anchor.BN(500).mul(
        new anchor.BN(10).pow(new anchor.BN(2))
      );

      const fee = transferAmount.muln(feeBasisPoint / 10_000);

      const transferTx = await program.methods
        .transferTo(transferAmount, fee)
        .accounts({
          mint: mint.publicKey,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          fromAcc: associatedTokenAcc,
          toAcc: receiverAssociatedTokenAcc,
          authority: admin.publicKey,
        })
        .transaction();

      const transfTxId = await sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: transferTx,
        signers: [admin],
      });

      console.log("TransferId", transfTxId);
    })
  );
});
