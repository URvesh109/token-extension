import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenExtension } from "../target/types/token_extension";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
  createAssociatedTokenAccountIdempotent,
} from "@solana/spl-token";
import {
  airdrop,
  assert,
  fetchAdminKeypair,
  fetchPayerKeypair,
  fetchReceiver2Keypair,
  fetchReceiver3Keypair,
  fetchReceiverKeypair,
  findWithheldTokenAndRemainingAccount,
  getWithheldAmount,
  runTest,
  sendAndConfirmTransaction,
} from "./utils";
import Debug from "debug";

const log = Debug("log: transferFee");

describe("✅ token-extension transfer fee", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;

  it(
    "Set transferFeeConfig",
    runTest(async () => {
      const admin = fetchAdminKeypair();

      const payer = fetchPayerKeypair();

      const receiver = fetchReceiverKeypair();

      const receiver2 = fetchReceiver2Keypair();

      const receiver3 = fetchReceiver3Keypair();

      await airdrop(provider, payer.publicKey);

      const mint = anchor.web3.Keypair.generate();
      log("Mint", mint.publicKey.toBase58());

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
            payer: payer.publicKey,
            allMintRole: admin.publicKey,
            token2022Program: TOKEN_2022_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .transaction(),
        signers: [admin, mint, payer],
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

      log("Receiver3 ATA ", receiver3AssociatedTokenAcc.toBase58());

      const transferAmount = new anchor.BN(500).mul(
        new anchor.BN(10).pow(new anchor.BN(2))
      );

      const fee = transferAmount.muln(feeBasisPoint / 10_000);

      let id = await sendAndConfirmTransaction({
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

      log("Transfer from admin to receiver txId", id);

      assert.strictEqual(
        await getWithheldAmount(
          provider.connection,
          receiverAssociatedTokenAcc,
          "transferFeeAmount"
        ),
        fee.toNumber()
      );

      id = await sendAndConfirmTransaction({
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
      log("withdrawWithheldAccount txId", id);

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

      id = await sendAndConfirmTransaction({
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
      log("harvestWithheldToken txId", id);

      assert.strictEqual(
        await getWithheldAmount(
          provider.connection,
          mint.publicKey,
          "transferFeeConfig"
        ),
        fee.toNumber() * 2
      );

      id = await sendAndConfirmTransaction({
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
      log("withdrawWithheldMint txId", id);

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
