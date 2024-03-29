import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenExtension } from "../target/types/token_extension";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
} from "@solana/spl-token";
import * as path from "path";
import {
  sendAndConfirmTransaction,
  airdrop,
  assert,
  fetchAdminKeypair,
  keypairFromFile,
  fetchPayerKeypair,
} from "./utils";
import Debug from "debug";

const log = Debug("log: metadataPointer");

describe("✅ token-extension: metadata pointer and token metadata", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;

  it("intialize metadata pointer and token metadata", async () => {
    const admin = fetchAdminKeypair();

    const payer = fetchPayerKeypair();

    await airdrop(provider, payer.publicKey);

    const fakeUpdateAuth = keypairFromFile(
      path.join(__dirname, "../keypairs/receiver.json")
    );
    log("FakeUpdateAuth", fakeUpdateAuth.publicKey.toBase58());

    const mint = anchor.web3.Keypair.generate();
    log("Mint", mint.publicKey.toBase58());

    await airdrop(provider, fakeUpdateAuth.publicKey);
    // case ExtensionType.TokenMetadata:
    //         throw Error(`Cannot get type length for variable extension type: ${e}`);
    const mintLen = new anchor.BN(getMintLen([ExtensionType.MetadataPointer])); // can't add ExtensionType.TokenMetadata

    const txId = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: await program.methods
        .initializeMetadataPointer(
          mintLen,
          2,
          "MyTokenName",
          "TOKEN",
          "http://my.token"
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
    log("Mint hook initialized txId ", txId);

    const newName = "YourToken";

    const id = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: await program.methods
        .updateMetadataField({ name: {} }, newName)
        .accounts({
          mint: mint.publicKey,
          payer: payer.publicKey,
          updateAuthority: admin.publicKey, // Update token metadata using correct updateAuthority
          token2022Program: TOKEN_2022_PROGRAM_ID,
        })
        .transaction(),
      signers: [admin, payer],
    });

    log("Update metadata txId ", id);

    const data = await provider.connection.getParsedAccountInfo(mint.publicKey);

    for (const iterator of data.value.data["parsed"]["info"]["extensions"]) {
      if (iterator["extension"] == "tokenMetadata") {
        assert.strictEqual(iterator["state"]["name"], newName);
      }
    }
  });
});
