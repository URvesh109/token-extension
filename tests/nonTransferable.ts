import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenExtension } from "../target/types/token_extension";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
  getAccountLen,
} from "@solana/spl-token";
import {
  airdrop,
  fetchAdminKeypair,
  fetchPayerKeypair,
  runTest,
  sendAndConfirmTransaction,
} from "./utils";
import Debug from "debug";

const log = Debug("log: nonTransferable");

describe("✅ tokenExtension: non transferable token", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;

  it(
    "create NonTransferable Token",
    runTest(async () => {
      const admin = fetchAdminKeypair();

      const payer = fetchPayerKeypair();

      await airdrop(provider, payer.publicKey);

      const mint = anchor.web3.Keypair.generate();
      log("Mint", mint.publicKey.toBase58());

      const account = anchor.web3.Keypair.generate();
      log("Account", account.publicKey.toBase58());

      await sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: await program.methods
          .nonTransferableToken(
            new anchor.BN(getMintLen([ExtensionType.NonTransferable])),
            new anchor.BN(
              getAccountLen([
                ExtensionType.NonTransferableAccount,
                ExtensionType.ImmutableOwner,
              ])
            )
          )
          .accounts({
            mint: mint.publicKey,
            token2022Program: TOKEN_2022_PROGRAM_ID,
            account: account.publicKey,
            payer: payer.publicKey,
            allMintRole: admin.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .transaction(),
        signers: [admin, mint, account, payer],
      });
    })
  );
});
