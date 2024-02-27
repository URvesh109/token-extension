import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenExtension } from "../target/types/token_extension";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
  createMint,
} from "@solana/spl-token";
import * as path from "path";
import {
  keypairFromFile,
  rejectedWith,
  sendAndConfirmTransaction,
} from "./utils";
import Debug from "debug";

const log = Debug("log:groupMemberPointer");

describe("token-extension: group and member pointer", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;

  const admin = keypairFromFile(path.join(__dirname, "../keypairs/admin.json"));
  log("Admin ", admin.publicKey.toBase58());

  const group = anchor.web3.Keypair.generate();
  log("Group", group.publicKey.toBase58());

  const member = anchor.web3.Keypair.generate();
  log("Member", member.publicKey.toBase58());

  it("intialize group and member mint pointer", async () => {
    const mintLen = new anchor.BN(getMintLen([ExtensionType.GroupPointer]));
    const maxSize = 12;
    const decimals = 2;

    const txId = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: await program.methods
        .initializeGroupPointer(mintLen, decimals, maxSize)
        .accounts({
          mint: group.publicKey,
          payer: admin.publicKey,
          allMintRole: admin.publicKey,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .transaction(),
      signers: [admin, group],
    });
    log("Group initialized txId ", txId);

    const mintLenGMP = new anchor.BN(
      getMintLen([ExtensionType.GroupMemberPointer])
    );

    const txIdGMP = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction: await program.methods
        .initializeMemberPointer(mintLenGMP, decimals)
        .accounts({
          member: member.publicKey,
          group: group.publicKey,
          payer: admin.publicKey,
          allMintRole: admin.publicKey,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .transaction(),
      signers: [admin, member],
    });
    log("Member initialized txId ", txIdGMP);
  });
});
