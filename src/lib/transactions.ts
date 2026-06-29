import {
  Asset,
  BASE_FEE,
  Contract,
  nativeToScVal,
  Operation,
  rpc,
  scValToNative,
  StrKey,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import {
  ESCROW_CONTRACT_ID,
  horizon,
  NETWORK_PASSPHRASE,
  sorobanRpc,
  xlmToStroops,
} from "./stellar";

export interface SubmitResult {
  hash: string;
  ledger: number;
}

export interface SorobanSubmitResult {
  hash: string;
  result?: unknown;
}

// Classic Stellar helpers (kept for account funding)

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
  const transaction = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

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

// Soroban escrow helpers

function getContract(): Contract {
  if (!ESCROW_CONTRACT_ID) {
    throw new Error("Escrow contract ID is not configured");
  }
  return new Contract(ESCROW_CONTRACT_ID);
}

function addressToScVal(address: string): xdr.ScVal {
  return nativeToScVal(address, { type: "address" });
}

export async function buildContractCall(
  sourceAddress: string,
  method: string,
  args: xdr.ScVal[]
): Promise<string> {
  const contract = getContract();
  const account = await sorobanRpc.getAccount(sourceAddress);

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(180)
    .build();

  const simulation = await sorobanRpc.simulateTransaction(transaction);

  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Simulation failed: ${simulation.error}`);
  }

  const prepared = rpc.assembleTransaction(transaction, simulation).build();
  return prepared.toXDR();
}

export async function submitSorobanTransaction(
  signedXdr: string
): Promise<SorobanSubmitResult> {
  const transaction = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  const response = await sorobanRpc.sendTransaction(transaction);

  if (response.status === "ERROR") {
    throw new Error(`Transaction submission failed: ${response.errorResult}`);
  }

  let status = await sorobanRpc.getTransaction(response.hash);
  while (status.status === "NOT_FOUND") {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    status = await sorobanRpc.getTransaction(response.hash);
  }

  if (status.status === "SUCCESS") {
    return {
      hash: response.hash,
      result: status.returnValue
        ? scValToNative(status.returnValue)
        : undefined,
    };
  }

  throw new Error(`Transaction failed with status: ${status.status}`);
}

export async function buildCreateEscrowTx(
  source: string,
  seller: string,
  buyer: string,
  amountXlm: string,
  memo: string,
  arbitrator?: string
): Promise<string> {
  const args = [
    addressToScVal(seller),
    addressToScVal(buyer),
    nativeToScVal(xlmToStroops(amountXlm), { type: "i128" }),
    nativeToScVal(memo, { type: "string" }),
    arbitrator
      ? nativeToScVal(arbitrator, { type: "address" })
      : nativeToScVal(null, { type: "address" }),
  ];
  return buildContractCall(source, "create_escrow", args);
}

export async function buildFundEscrowTx(
  source: string,
  id: number
): Promise<string> {
  const args = [nativeToScVal(id, { type: "u64" })];
  return buildContractCall(source, "fund_escrow", args);
}

export async function buildReleaseEscrowTx(
  source: string,
  id: number
): Promise<string> {
  const args = [nativeToScVal(id, { type: "u64" })];
  return buildContractCall(source, "release_escrow", args);
}

export async function buildRefundEscrowTx(
  source: string,
  id: number
): Promise<string> {
  const args = [nativeToScVal(id, { type: "u64" })];
  return buildContractCall(source, "refund_escrow", args);
}

export async function buildDisputeEscrowTx(
  source: string,
  id: number
): Promise<string> {
  const args = [addressToScVal(source), nativeToScVal(id, { type: "u64" })];
  return buildContractCall(source, "dispute_escrow", args);
}

export async function buildResolveDisputeTx(
  source: string,
  id: number,
  toSeller: boolean
): Promise<string> {
  const args = [
    addressToScVal(source),
    nativeToScVal(id, { type: "u64" }),
    nativeToScVal(toSeller),
  ];
  return buildContractCall(source, "resolve_dispute", args);
}

export interface EscrowState {
  id: number;
  seller: string;
  buyer: string;
  amount: string;
  memo: string;
  status: { tag: string; values?: unknown[] } | string;
  created_at: number;
  timeout_at: number;
  arbitrator?: string | null;
}

function getNativeField<T>(native: unknown, key: string): T | undefined {
  if (native instanceof Map) {
    return native.get(key) as T | undefined;
  }
  if (typeof native === "object" && native !== null) {
    return (native as Record<string, unknown>)[key] as T | undefined;
  }
  return undefined;
}

function parseStatusValue(status: unknown): EscrowState["status"] {
  if (typeof status === "string") return status;
  if (Array.isArray(status)) {
    const tag = status[0];
    if (typeof tag === "string") return { tag, values: status.slice(1) };
  }
  if (status instanceof Map) {
    const tag = status.get("tag");
    if (typeof tag === "string") return { tag, values: status.get("values") };
  }
  if (typeof status === "object" && status !== null) {
    const tag = (status as { tag?: unknown }).tag;
    const values = (status as { values?: unknown }).values;
    if (typeof tag === "string") {
      return { tag, values: Array.isArray(values) ? values : undefined };
    }
  }
  return "";
}

export async function getEscrowState(id: number): Promise<EscrowState | null> {
  const contract = getContract();
  const args = [nativeToScVal(id, { type: "u64" })];

  // Build a read-only transaction using a throwaway source account.
  // The account only needs a valid format; it does not need to exist for simulation.
  const kp = StrKey.encodeEd25519PublicKey(Buffer.alloc(32)) as string;
  const account = await sorobanRpc.getAccount(kp).catch(() => ({
    accountId: () => kp,
    sequenceNumber: "0",
  }));

  const tx = new TransactionBuilder(account as never, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("get_escrow", ...args))
    .setTimeout(0)
    .build();

  const simulation = await sorobanRpc.simulateTransaction(tx);

  if (
    rpc.Api.isSimulationSuccess(simulation) &&
    simulation.result &&
    simulation.result.retval
  ) {
    const native = scValToNative(simulation.result.retval) as
      | Record<string, unknown>
      | Map<string, unknown>
      | null;
    if (!native) return null;

    return {
      id: Number(getNativeField<unknown>(native, "id")),
      seller: getNativeField<string>(native, "seller") ?? "",
      buyer: getNativeField<string>(native, "buyer") ?? "",
      amount: String(getNativeField<bigint | string>(native, "amount") ?? 0),
      memo: getNativeField<string>(native, "memo") ?? "",
      status: parseStatusValue(getNativeField<unknown>(native, "status")),
      created_at: Number(getNativeField<unknown>(native, "created_at") ?? 0),
      timeout_at: Number(getNativeField<unknown>(native, "timeout_at") ?? 0),
      arbitrator:
        (getNativeField<string | null>(native, "arbitrator") ?? null) || null,
    };
  }

  return null;
}

export function parseContractError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message;

    if (message.includes("EscrowNotFound")) {
      return "Escrow not found.";
    }
    if (message.includes("InvalidAmount")) {
      return "Invalid escrow amount.";
    }
    if (message.includes("Unauthorized")) {
      return "You are not authorized to perform this action.";
    }
    if (message.includes("AlreadyFunded")) {
      return "This escrow has already been funded.";
    }
    if (message.includes("AlreadyReleased")) {
      return "This escrow has already been released.";
    }
    if (message.includes("AlreadyRefunded")) {
      return "This escrow has already been refunded.";
    }
    if (message.includes("NotFunded")) {
      return "This escrow must be funded before it can be released.";
    }
    if (message.includes("RefundNotAvailable")) {
      return "Refund is not available for this escrow.";
    }
    if (message.includes("AlreadyDisputed")) {
      return "This escrow is already under dispute.";
    }
    if (message.includes("NotDisputed")) {
      return "This escrow is not under dispute.";
    }
    if (message.includes("ContractPaused")) {
      return "The escrow contract is currently paused.";
    }
    if (message.includes("NotInitialized")) {
      return "The escrow contract has not been initialized.";
    }
    if (message.includes("AlreadyInitialized")) {
      return "The escrow contract has already been initialized.";
    }
    if (message.includes("Simulation failed")) {
      return message.replace("Simulation failed: ", "");
    }

    return message;
  }

  return "An unexpected contract error occurred.";
}
