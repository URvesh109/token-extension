import * as anchor from "@coral-xyz/anchor";
import { readFileSync } from "fs";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";

export function keypairFromFile(path: string): anchor.web3.Keypair {
  return anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(readFileSync(path).toString("utf-8")) as number[]
    )
  );
}

export async function sendAndConfirmTransaction({
  connection,
  transaction,
  signers,
}: {
  connection: anchor.web3.Connection;
  transaction: anchor.web3.Transaction;
  signers: Array<anchor.web3.Signer>;
}) {
  return await anchor.web3.sendAndConfirmTransaction(
    connection,
    transaction,
    signers,
    {
      commitment: "processed",
    }
  );
}

export function runTest(f: () => Promise<any>): () => Promise<any> {
  return async () => {
    try {
      return await f();
    } catch (e) {
      console.log("TEST FAILED: ", e);
      throw e;
    }
  };
}

chai.use(chaiAsPromised);
export const { assert, expect } = chai;

export async function fulfilled<T>(promise: Promise<T>) {
  await expect(promise).to.be.fulfilled;
}

export async function rejectedWith<T>(
  promise: Promise<T>,
  constructor: Error | Function,
  expected?: string | RegExp,
  message?: string
) {
  await expect(promise).to.be.rejectedWith(constructor, expected, message);
}
