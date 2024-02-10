import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenExtension } from "../target/types/token_extension";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
  AccountState,
} from "@solana/spl-token";
import * as path from "path";
import {
  assert,
  getTokenExtensionState,
  keypairFromFile,
  runTest,
  sendAndConfirmTransaction,
} from "./utils";

describe("tokenExtension: DefaultAccountState", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;

  const admin = keypairFromFile(path.join(__dirname, "../keypairs/admin.json"));

  const mint = anchor.web3.Keypair.generate();
  console.log("Mint", mint.publicKey.toBase58());

  it(
    "frozen and initialized defaultState",
    runTest(async () => {
      const defaultAccStateTx = await program.methods
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
        .transaction();

      await sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: defaultAccStateTx,
        signers: [admin, mint],
      });

      let result = await getTokenExtensionState(
        provider.connection,
        mint.publicKey,
        "defaultAccountState",
        "accountState"
      );

      assert.equal("frozen", result);

      const updateAccStateTx = await program.methods
        .updateDefaultAccountState(AccountState.Initialized)
        .accounts({
          mint: mint.publicKey,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          freezeAuth: admin.publicKey,
        })
        .transaction();

      await sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: updateAccStateTx,
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
