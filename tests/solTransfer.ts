import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Opaque } from "../target/types/opaque";
import * as path from "path";
import { keypairFromFile, sendAndConfirmTransaction } from "./utils";
import Debug from "debug";

const log = Debug("log:solTransfer");

describe("Sol transfer", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Opaque as Program<Opaque>;

  const admin = keypairFromFile(path.join(__dirname, "../keypairs/admin.json"));
  const receiver = keypairFromFile(
    path.join(__dirname, "../keypairs/receiver.json")
  );

  it("transfer sol from admin to receiver", async () => {
    const transaction = await program.methods
      .transferSol(new anchor.BN(10 * anchor.web3.LAMPORTS_PER_SOL))
      .accounts({
        fromWallet: admin.publicKey,
        toWallet: receiver.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .transaction();

    transaction.feePayer = admin.publicKey;

    const txId = await sendAndConfirmTransaction({
      connection: provider.connection,
      transaction,
      signers: [admin],
    });
    log("sol transfer txId ", txId);
  });
});
