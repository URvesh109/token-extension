import * as anchor from "@coral-xyz/anchor";
import { readFileSync } from "fs";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import {
  TOKEN_2022_PROGRAM_ID,
  getTransferFeeAmount,
  unpackAccount,
} from "@solana/spl-token";
import Debug from "debug";

export const log = Debug("log:");

export const MEMO_PROGRAM_ID = new anchor.web3.PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

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
    { commitment: "finalized", skipPreflight: true }
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

export async function findWithheldTokenAndRemainingAccount({
  connection,
  mint,
}: {
  connection: anchor.web3.Connection;
  mint: anchor.web3.PublicKey;
}): Promise<Array<anchor.web3.AccountMeta>> {
  const allAccounts = await connection.getProgramAccounts(
    TOKEN_2022_PROGRAM_ID,
    {
      commitment: "confirmed",
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: mint.toString(),
          },
        },
      ],
    }
  );
  const accountsToWithdrawFrom: anchor.web3.AccountMeta[] = [];
  for (const accountInfo of allAccounts) {
    const account = unpackAccount(
      accountInfo.pubkey,
      accountInfo.account,
      TOKEN_2022_PROGRAM_ID
    );
    const transferFeeAmount = getTransferFeeAmount(account);
    if (
      transferFeeAmount !== null &&
      transferFeeAmount.withheldAmount > BigInt(0)
    ) {
      accountsToWithdrawFrom.push({
        pubkey: accountInfo.pubkey,
        isSigner: false,
        isWritable: true,
      });
    }
  }

  return accountsToWithdrawFrom;
}

export async function getWithheldAmount(
  connection: anchor.web3.Connection,
  publicKey: anchor.web3.PublicKey,
  extensionKey: string
): Promise<number> {
  const data = await connection.getParsedAccountInfo(publicKey, {
    commitment: "finalized",
  });

  for (const iterator of data.value.data["parsed"]["info"]["extensions"]) {
    if (iterator["extension"] == extensionKey) {
      return Promise.resolve(iterator["state"]["withheldAmount"]);
    }
  }
}

export async function getTokenExtensionState(
  connection: anchor.web3.Connection,
  publicKey: anchor.web3.PublicKey,
  extensionKey: string,
  extensionValue: string
) {
  const data = await connection.getParsedAccountInfo(publicKey, {
    commitment: "finalized",
  });

  for (const iterator of data.value.data["parsed"]["info"]["extensions"]) {
    if (iterator["extension"] == extensionKey) {
      return Promise.resolve(iterator["state"][`${extensionValue}`]);
    }
  }
}

export async function airdrop(
  provider: anchor.AnchorProvider,
  ...addresses: anchor.web3.PublicKey[]
) {
  await Promise.all(
    addresses.map(async (address) => {
      const signature = await provider.connection.requestAirdrop(address, 10e9);
      const latestBlockHash = await provider.connection.getLatestBlockhash();
      await provider.connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature,
      });
    })
  );
}
