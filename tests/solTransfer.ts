import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Opaque } from "../target/types/opaque";
import {
  fetchAdminKeypair,
  fetchReceiverKeypair,
  sendAndConfirmTransaction,
} from "./utils";
import Debug from "debug";

const log = Debug("log: solTransfer");

describe("✅ sol transfer", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Opaque as Program<Opaque>;

  it("transfer sol from admin to receiver", async () => {
    const admin = fetchAdminKeypair();

    const receiver = fetchReceiverKeypair();

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
    log("TxId ", txId);
  });
});
