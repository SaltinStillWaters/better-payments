import {
  Asset,
  BASE_FEE,
  Operation,
  StrKey,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { horizon, NETWORK_PASSPHRASE } from "./stellar";

export interface SubmitResult {
  hash: string;
  ledger: number;
}

export async function buildPaymentTx(
  source: string,
  destination: string,
  amount: string
): Promise<string> {
  if (!StrKey.isValidEd25519PublicKey(destination)) {
    throw new Error("Invalid destination Stellar address");
  }

  const account = await horizon.loadAccount(source);

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination,
        asset: Asset.native(),
        amount,
      })
    )
    .setTimeout(180)
    .build();

  return transaction.toXDR();
}

export async function submitTransaction(
  signedXdr: string
): Promise<SubmitResult> {
  const transaction = TransactionBuilder.fromXDR(
    signedXdr,
    NETWORK_PASSPHRASE
  );

  const result = await horizon.submitTransaction(transaction);

  const hash = result.hash;
  const ledger = result.ledger;

  if (!hash) {
    throw new Error("Transaction submitted but no hash was returned");
  }

  return { hash, ledger };
}

export function parseHorizonError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message;

    if (message.includes("tx_insufficient_balance")) {
      return "Insufficient XLM balance for this transaction.";
    }
    if (message.includes("tx_bad_auth")) {
      return "Transaction authorization failed. Check your network and try again.";
    }
    if (message.includes("tx_bad_seq")) {
      return "Sequence number mismatch. Please refresh and try again.";
    }
    if (message.includes("op_no_destination")) {
      return "The destination account does not exist.";
    }
    if (message.includes("tx_too_late")) {
      return "Transaction timed out. Please try again.";
    }

    return message;
  }

  return "An unexpected error occurred.";
}
