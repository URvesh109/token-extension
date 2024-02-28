import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenExtension } from "../target/types/token_extension";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
} from "@solana/spl-token";
import { fetchAdminKeypair, runTest, sendAndConfirmTransaction } from "./utils";
import { assert } from "chai";
import Debug from "debug";

const log = Debug("log: mintCloseAuthority");

describe("✅ token-extension: mintCloseAuthority and closeMintAccount", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;

  it(
    "Set mintCloseAuthority and closeMintAccount",
    runTest(async () => {
      const admin = fetchAdminKeypair();

      const mint = anchor.web3.Keypair.generate();
      log("Mint", mint.publicKey.toBase58());

      // Add your test here.
      await sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: await program.methods
          .mintCloseAuthority(
            new anchor.BN(getMintLen([ExtensionType.MintCloseAuthority]))
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

      const data = await provider.connection.getParsedAccountInfo(
        mint.publicKey
      );

      for (const iterator of data.value.data["parsed"]["info"]["extensions"]) {
        if (iterator["extension"] == "mintCloseAuthority") {
          assert.strictEqual(
            iterator["state"]["closeAuthority"],
            admin.publicKey.toBase58()
          );
        }
      }

      await sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: await program.methods
          .closeMintAccount()
          .accounts({
            mint: mint.publicKey,
            destination: admin.publicKey,
            authority: admin.publicKey,
            token2022Program: TOKEN_2022_PROGRAM_ID,
          })
          .transaction(),
        signers: [admin],
      });

      const deletedMintAcc = await provider.connection.getParsedAccountInfo(
        mint.publicKey
      );
      assert.isNull(deletedMintAcc.value);
    })
  );
});
