import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenExtension } from "../target/types/token_extension";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getOrCreateAssociatedTokenAccount,
  getMintLen,
  createAssociatedTokenAccountIdempotent,
  mintTo,
} from "@solana/spl-token";
import * as path from "path";
import { keypairFromFile, runTest, sendAndConfirmTransaction } from "./utils";
import Debug from "debug";

const log = Debug("log: IBT");

describe("tokenExtension: Interest Bearing Token", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenExtension as Program<TokenExtension>;

  const admin = keypairFromFile(path.join(__dirname, "../keypairs/admin.json"));

  const mint = anchor.web3.Keypair.generate();
  log("Mint", mint.publicKey.toBase58());

  it(
    "initialized interest bearing token",
    runTest(async () => {
      const id = await sendAndConfirmTransaction({
        connection: provider.connection,
        transaction: await program.methods
          .interestBearingToken(
            new anchor.BN(getMintLen([ExtensionType.InterestBearingConfig])),
            5
          )
          .accounts({
            mint: mint.publicKey,
            token2022Program: TOKEN_2022_PROGRAM_ID,
            payer: admin.publicKey,
            allMintRole: admin.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .transaction(),
        signers: [admin, mint],
      });
      log("tx ", id);

      const associatedTokenAcc = await createAssociatedTokenAccountIdempotent(
        provider.connection,
        admin,
        mint.publicKey,
        admin.publicKey,
        { commitment: "finalized", skipPreflight: true },
        TOKEN_2022_PROGRAM_ID
      );
      log("Admin ATA created ", associatedTokenAcc.toBase58());

      const txId = await mintTo(
        provider.connection,
        admin,
        mint.publicKey,
        associatedTokenAcc,
        admin.publicKey,
        20 * 10 ** 2,
        [],
        { commitment: "finalized", skipPreflight: true },
        TOKEN_2022_PROGRAM_ID
      );

      log("Mint to txId ", txId);

      // Check
      const ata = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        admin,
        mint.publicKey,
        admin.publicKey,
        false,
        "finalized",
        { skipPreflight: true, commitment: "finalized" },
        TOKEN_2022_PROGRAM_ID
      );

      log("TokenA ", ata.amount.toString());

      const amountTx = await program.methods
        .amountToUiAmount(new anchor.BN(ata.amount.toString()))
        .accounts({
          mint: mint.publicKey,
          token2022Program: TOKEN_2022_PROGRAM_ID,
        })
        .view();

      log("amountUi ", amountTx);
    })
  );
});
