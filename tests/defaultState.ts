import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenExtension } from "../target/types/token_extension";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
  AccountState,
} from "@solana/spl-token";
import {
  assert,
  fetchAdminKeypair,
  getTokenExtensionState,
  runTest,
  sendAndConfirmTransaction,
} from "./utils";
import Debug from "debug";

const log = Debug("log: defaultAccState");

describe("✅ tokenExtension: default account state", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;

  it(
    "frozen and initialize defaultState",
    runTest(async () => {
      const admin = fetchAdminKeypair();

      const mint = anchor.web3.Keypair.generate();
      log("Mint", mint.publicKey.toBase58());

      const mintId = await sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: await program.methods
          .defaultAccountState(
            new anchor.BN(getMintLen([ExtensionType.DefaultAccountState]))
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

      log("Mint with defaultAccountState txId", mintId);

      let result = await getTokenExtensionState(
        provider.connection,
        mint.publicKey,
        "defaultAccountState",
        "accountState"
      );

      assert.equal("frozen", result);

      await sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: await program.methods
          .updateDefaultAccountState(AccountState.Initialized)
          .accounts({
            mint: mint.publicKey,
            token2022Program: TOKEN_2022_PROGRAM_ID,
            freezeAuth: admin.publicKey,
          })
          .transaction(),
        signers: [admin],
      });

      result = await getTokenExtensionState(
        provider.connection,
        mint.publicKey,
        "defaultAccountState",
        "accountState"
      );

      assert.equal("initialized", result);
    })
  );
});
