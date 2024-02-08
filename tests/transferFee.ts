import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenExtension } from "../target/types/token_extension";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
  createAssociatedTokenAccountIdempotent,
  closeAccount,
} from "@solana/spl-token";
import * as path from "path";
import {
  findWithheldTokenAccount,
  keypairFromFile,
  runTest,
  sendAndConfirmTransaction,
} from "./utils";

describe("token-extension transfer-fee", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;

  const admin = keypairFromFile(path.join(__dirname, "../keypairs/admin.json"));

  const receiver = keypairFromFile(
    path.join(__dirname, "../keypairs/receiver.json")
  );

  const receiver2 = keypairFromFile(
    path.join(__dirname, "../keypairs/receiver2.json")
  );

  const receiver3 = keypairFromFile(
    path.join(__dirname, "../keypairs/receiver3.json")
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
        { commitment: "finalized" },
        TOKEN_2022_PROGRAM_ID
      );

      console.log("Associated ", associatedTokenAcc.toBase58());

      const mintTx = await program.methods
        .mintTo(
          new anchor.BN(2000).mul(new anchor.BN(10).pow(new anchor.BN(2)))
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
          { commitment: "finalized" },
          TOKEN_2022_PROGRAM_ID
        );

      console.log(
        "receiverAssociatedTokenAcc ",
        receiverAssociatedTokenAcc.toBase58()
      );

      const receiver2AssociatedTokenAcc =
        await createAssociatedTokenAccountIdempotent(
          provider.connection,
          admin,
          mint.publicKey,
          receiver2.publicKey,
          { commitment: "finalized" },
          TOKEN_2022_PROGRAM_ID
        );

      console.log(
        "receiver2AssociatedTokenAcc ",
        receiver2AssociatedTokenAcc.toBase58()
      );

      const receiver3AssociatedTokenAcc =
        await createAssociatedTokenAccountIdempotent(
          provider.connection,
          admin,
          mint.publicKey,
          receiver3.publicKey,
          { commitment: "finalized" },
          TOKEN_2022_PROGRAM_ID
        );

      console.log(
        "receiver3AssociatedTokenAcc ",
        receiver3AssociatedTokenAcc.toBase58()
      );

      const transferAmount = new anchor.BN(500).mul(
        new anchor.BN(10).pow(new anchor.BN(2))
      );

      const fee = transferAmount.muln(feeBasisPoint / 10_000);

      const firstTransferIx = await program.methods
        .transferTo(transferAmount, fee)
        .accounts({
          mint: mint.publicKey,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          fromAcc: associatedTokenAcc,
          toAcc: receiverAssociatedTokenAcc,
          authority: admin.publicKey,
        })
        .instruction();

      const transaction = new anchor.web3.Transaction();

      transaction.add(firstTransferIx);

      await sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: transaction,
        signers: [admin],
      });

      const result = await findWithheldTokenAccount({
        connection: provider.connection,
        mint: mint.publicKey,
      });

      const remainingAccounts: anchor.web3.AccountMeta[] = [];

      for (let pubkey of result) {
        remainingAccounts.push({
          pubkey,
          isSigner: false,
          isWritable: true,
        });
      }

      const withheldTx = await program.methods
        .withdrawWithheldAccount()
        .accounts({
          mint: mint.publicKey,
          destination: associatedTokenAcc,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          authority: admin.publicKey,
        })
        .remainingAccounts(remainingAccounts)
        .transaction();

      await sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: withheldTx,
        signers: [admin],
      });

      const secondTransferIx = await program.methods
        .transferTo(transferAmount, fee)
        .accounts({
          mint: mint.publicKey,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          fromAcc: associatedTokenAcc,
          toAcc: receiver2AssociatedTokenAcc,
          authority: admin.publicKey,
        })
        .instruction();

      const thirdTransferIx = await program.methods
        .transferTo(transferAmount, fee)
        .accounts({
          mint: mint.publicKey,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          fromAcc: associatedTokenAcc,
          toAcc: receiver3AssociatedTokenAcc,
          authority: admin.publicKey,
        })
        .instruction();

      const transaction2 = new anchor.web3.Transaction();

      transaction2.add(secondTransferIx);
      transaction2.add(thirdTransferIx);

      await sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: transaction2,
        signers: [admin],
      });

      const result2 = await findWithheldTokenAccount({
        connection: provider.connection,
        mint: mint.publicKey,
      });

      const remainingAccounts2: anchor.web3.AccountMeta[] = [];

      for (let pubkey of result2) {
        remainingAccounts2.push({
          pubkey,
          isSigner: false,
          isWritable: true,
        });
      }

      const harvestTx = await program.methods
        .harvestWithheldToken()
        .accounts({
          mint: mint.publicKey,
          token2022Program: TOKEN_2022_PROGRAM_ID,
        })
        .remainingAccounts(remainingAccounts2)
        .transaction();

      await sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: harvestTx,
        signers: [admin],
      });

      const withheldMintTx = await program.methods
        .withdrawWithheldMint()
        .accounts({
          mint: mint.publicKey,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          authority: admin.publicKey,
          destination: associatedTokenAcc,
        })
        .transaction();

      const id = await sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: withheldMintTx,
        signers: [admin],
      });

      console.log("Mint withheld tx id", id);
    })
  );
});
