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
import {
  assert,
  findWithheldTokenAndRemainingAccount,
  getWithheldAmount,
  keypairFromFile,
  runTest,
  sendAndConfirmTransaction,
} from "./utils";
import Debug from "debug";

const log = Debug("log: transferFee");

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
  log("Mint", mint.publicKey.toBase58());

  it(
    "Set transferFeeConfig",
    runTest(async () => {
      const feeBasisPoint = 50;

      await sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: await program.methods
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
          .transaction(),
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

      log("Admin ATA ", associatedTokenAcc.toBase58());

      await sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: await program.methods
          .mintTo(
            new anchor.BN(2000).mul(new anchor.BN(10).pow(new anchor.BN(2)))
          )
          .accounts({
            mint: mint.publicKey,
            token2022Program: TOKEN_2022_PROGRAM_ID,
            associatedToken: associatedTokenAcc,
            authority: admin.publicKey,
          })
          .transaction(),
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

      log("Receiver ATA ", receiverAssociatedTokenAcc.toBase58());

      const receiver2AssociatedTokenAcc =
        await createAssociatedTokenAccountIdempotent(
          provider.connection,
          admin,
          mint.publicKey,
          receiver2.publicKey,
          { commitment: "finalized" },
          TOKEN_2022_PROGRAM_ID
        );

      log("Receiver2 ATA ", receiver2AssociatedTokenAcc.toBase58());

      const receiver3AssociatedTokenAcc =
        await createAssociatedTokenAccountIdempotent(
          provider.connection,
          admin,
          mint.publicKey,
          receiver3.publicKey,
          { commitment: "finalized" },
          TOKEN_2022_PROGRAM_ID
        );

      log("Receiver2 ATA ", receiver3AssociatedTokenAcc.toBase58());

      const transferAmount = new anchor.BN(500).mul(
        new anchor.BN(10).pow(new anchor.BN(2))
      );

      const fee = transferAmount.muln(feeBasisPoint / 10_000);

      await sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: await program.methods
          .transferTo(transferAmount, fee)
          .accounts({
            mint: mint.publicKey,
            token2022Program: TOKEN_2022_PROGRAM_ID,
            fromAcc: associatedTokenAcc,
            toAcc: receiverAssociatedTokenAcc,
            authority: admin.publicKey,
          })
          .transaction(),
        signers: [admin],
      });

      assert.strictEqual(
        await getWithheldAmount(
          provider.connection,
          receiverAssociatedTokenAcc,
          "transferFeeAmount"
        ),
        fee.toNumber()
      );

      await sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: await program.methods
          .withdrawWithheldAccount()
          .accounts({
            mint: mint.publicKey,
            destination: associatedTokenAcc,
            token2022Program: TOKEN_2022_PROGRAM_ID,
            authority: admin.publicKey,
          })
          .remainingAccounts(
            await findWithheldTokenAndRemainingAccount({
              connection: provider.connection,
              mint: mint.publicKey,
            })
          )
          .transaction(),
        signers: [admin],
      });

      assert.strictEqual(
        await getWithheldAmount(
          provider.connection,
          receiverAssociatedTokenAcc,
          "transferFeeAmount"
        ),
        0
      );

      const transaction = new anchor.web3.Transaction();

      transaction.add(
        await program.methods
          .transferTo(transferAmount, fee)
          .accounts({
            mint: mint.publicKey,
            token2022Program: TOKEN_2022_PROGRAM_ID,
            fromAcc: associatedTokenAcc,
            toAcc: receiver2AssociatedTokenAcc,
            authority: admin.publicKey,
          })
          .instruction()
      );
      transaction.add(
        await program.methods
          .transferTo(transferAmount, fee)
          .accounts({
            mint: mint.publicKey,
            token2022Program: TOKEN_2022_PROGRAM_ID,
            fromAcc: associatedTokenAcc,
            toAcc: receiver3AssociatedTokenAcc,
            authority: admin.publicKey,
          })
          .instruction()
      );

      await sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: transaction,
        signers: [admin],
      });

      await sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: await program.methods
          .harvestWithheldToken()
          .accounts({
            mint: mint.publicKey,
            token2022Program: TOKEN_2022_PROGRAM_ID,
          })
          .remainingAccounts(
            await findWithheldTokenAndRemainingAccount({
              connection: provider.connection,
              mint: mint.publicKey,
            })
          )
          .transaction(),
        signers: [admin],
      });

      assert.strictEqual(
        await getWithheldAmount(
          provider.connection,
          mint.publicKey,
          "transferFeeConfig"
        ),
        fee.toNumber() * 2
      );

      await sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: await program.methods
          .withdrawWithheldMint()
          .accounts({
            mint: mint.publicKey,
            token2022Program: TOKEN_2022_PROGRAM_ID,
            authority: admin.publicKey,
            destination: associatedTokenAcc,
          })
          .transaction(),
        signers: [admin],
      });

      assert.strictEqual(
        await getWithheldAmount(
          provider.connection,
          mint.publicKey,
          "transferFeeConfig"
        ),
        0
      );
    })
  );
});
