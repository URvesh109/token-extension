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
import { keypairFromFile, sendAndConfirmTransaction } from "./utils";
import Debug from "debug";

const log = Debug("log:groupPointer");

describe("token-extension: group pointer", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;

  const admin = keypairFromFile(path.join(__dirname, "../keypairs/admin.json"));
  log("Admin ", admin.publicKey.toBase58());

  const mint = anchor.web3.Keypair.generate();
  log("Mint", mint.publicKey.toBase58());

  const groupAddress = anchor.web3.Keypair.generate();
  log("GroupAddress", groupAddress.publicKey.toBase58());

  it("intialize group pointer", async () => {
    const mintLen = new anchor.BN(getMintLen([ExtensionType.GroupPointer]));
    const accountLen = new anchor.BN(
      getAccountLen([ExtensionType.GroupPointer])
    );
    const maxSize = 12;
    const decimals = 2;

    const txId = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: await program.methods
        .initializeGroupPointer(mintLen, accountLen, decimals, maxSize)
        .accounts({
          mint: mint.publicKey,
          groupAddress: groupAddress.publicKey,
          payer: admin.publicKey,
          allMintRole: admin.publicKey,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .transaction(),
      signers: [admin, mint, groupAddress],
    });
    log("Mint initialized txId ", txId); // TODO: fix this issue: "Error: Invalid instruction"
  });
});
