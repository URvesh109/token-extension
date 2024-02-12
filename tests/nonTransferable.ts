import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenExtension } from "../target/types/token_extension";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
  getAccountLen,
} from "@solana/spl-token";
import * as path from "path";
import { keypairFromFile, runTest, sendAndConfirmTransaction } from "./utils";

describe("tokenExtension: NonTransferableToken", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;

  const admin = keypairFromFile(path.join(__dirname, "../keypairs/admin.json"));

  const mint = anchor.web3.Keypair.generate();
  console.log("Mint", mint.publicKey.toBase58());

  const account = anchor.web3.Keypair.generate();
  console.log("Account", account.publicKey.toBase58());

  it(
    "create NonTransferable Token",
    runTest(async () => {
      const nonTransferableTx = await program.methods
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
          payer: admin.publicKey,
          allMintRole: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .transaction();

      await sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: nonTransferableTx,
        signers: [admin, mint, account],
      });
    })
  );
});
