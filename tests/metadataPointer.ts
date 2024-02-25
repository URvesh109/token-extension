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
  keypairFromFile,
  sendAndConfirmTransaction,
  airdrop,
  assert,
} from "./utils";
import Debug from "debug";

const log = Debug("log:metadaPointer & tokenMetadata");

describe("token-extension: metadata pointer and token metadata", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;

  const admin = keypairFromFile(path.join(__dirname, "../keypairs/admin.json"));
  log("Admin ", admin.publicKey.toBase58());

  const fakeUpdateAuth = keypairFromFile(
    path.join(__dirname, "../keypairs/receiver.json")
  );
  log("FakeUpdateAuth ", fakeUpdateAuth.publicKey.toBase58());

  const mint = anchor.web3.Keypair.generate();
  log("Mint", mint.publicKey.toBase58());

  it("intialize metadata pointer and token metadata", async () => {
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
          payer: admin.publicKey,
          allMintRole: admin.publicKey,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .transaction(),
      signers: [admin, mint],
    });
    log("Mint hook initialized txId ", txId);

    const newName = "YourToken";

    const id = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: await program.methods
        .updateMetadataField({ name: {} }, newName)
        .accounts({
          mint: mint.publicKey,
          payer: admin.publicKey,
          updateAuthority: admin.publicKey, // Update token metadata using correct updateAuthority
          token2022Program: TOKEN_2022_PROGRAM_ID,
        })
        .transaction(),
      signers: [admin],
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
