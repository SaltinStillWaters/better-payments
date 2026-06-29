"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import { parseEscrowQrString } from "@/lib/qr";
import {
  buildFundEscrowTx,
  buildReleaseEscrowTx,
  buildRefundEscrowTx,
  buildDisputeEscrowTx,
  buildResolveDisputeTx,
  EscrowState,
  getEscrowState,
} from "@/lib/transactions";
import { stroopsToXlm } from "@/lib/stellar";
import { useEscrowStore } from "@/store/escrowStore";
import { useTransaction } from "@/hooks/useTransaction";
import { Card } from "./Card";
import { SkeletonLoader } from "./SkeletonLoader";
import { RetryButton } from "./RetryButton";
import { TransactionStatus } from "./TransactionStatus";

const Scanner = dynamic(
  () => import("@yudiel/react-qr-scanner").then((mod) => mod.Scanner),
  { ssr: false }
);

function getStatusLabel(escrow: EscrowState | null): string {
  if (!escrow) return "";
  const { status } = escrow;
  if (typeof status === "string") return status;
  if (Array.isArray(status)) return String(status[0] ?? "");
  if (status && typeof status === "object") return status.tag ?? "";
  return "";
}

export function BuyerPanel() {
  const { address, sign } = useStellarWallet();
  const [mode, setMode] = useState<"manual" | "scan">("manual");
  const [escrowIdInput, setEscrowIdInput] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [now, setNow] = useState<number>(0);
  const [txMessage, setTxMessage] = useState<{
    success: string;
    error: string;
  }>({
    success: "Transaction submitted successfully!",
    error: "Transaction failed",
  });

  const escrowId = Number(escrowIdInput);
  const escrow = useEscrowStore((s) =>
    !Number.isNaN(escrowId) ? s.escrows[escrowId] : undefined
  );
  const pending = useEscrowStore((s) =>
    !Number.isNaN(escrowId) ? s.pending[escrowId] : false
  );
  const { setEscrow, setPending, optimisticStatus } = useEscrowStore();

  const tx = useTransaction(sign);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setNow(Math.floor(Date.now() / 1000));
    const interval = setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      60_000
    );
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => clearInterval(interval);
  }, []);

  const loadEscrow = async (id: number) => {
    setLookupLoading(true);
    setLookupError(null);
    try {
      const state = await getEscrowState(id);
      setEscrow(id, state);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load escrow";
      setLookupError(msg);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleScan = (result: Array<{ rawValue: string }> | undefined) => {
    const value = result?.[0]?.rawValue;
    if (!value) return;

    const params = parseEscrowQrString(value);
    if (!params) {
      setLookupError("Invalid payment QR code");
      return;
    }

    setEscrowIdInput(params.escrowId.toString());
    setMode("manual");
    setLookupError(null);
    void loadEscrow(params.escrowId);
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Number.isNaN(escrowId) || escrowId <= 0) {
      setLookupError("Invalid escrow ID");
      return;
    }
    setLookupError(null);
    await loadEscrow(escrowId);
  };

  const runTransaction = async (
    builder: () => Promise<string>,
    optimisticTag?: string,
    messages?: { success: string; error: string }
  ) => {
    if (!address) return;
    if (messages) setTxMessage(messages);
    if (optimisticTag) optimisticStatus(escrowId, { tag: optimisticTag });
    setPending(escrowId, true);
    try {
      await tx.execute(builder);
      await loadEscrow(escrowId);
    } finally {
      setPending(escrowId, false);
    }
  };

  const handleFund = () =>
    runTransaction(() => buildFundEscrowTx(address!, escrowId), "Funded", {
      success: "Escrow funded",
      error: "Failed to fund escrow",
    });

  const handleRelease = () =>
    runTransaction(() => buildReleaseEscrowTx(address!, escrowId), "Released", {
      success: "Funds released to seller",
      error: "Failed to release funds",
    });

  const handleRefund = () =>
    runTransaction(() => buildRefundEscrowTx(address!, escrowId), "Refunded", {
      success: "Escrow refunded",
      error: "Failed to refund escrow",
    });

  const handleDispute = () =>
    runTransaction(() => buildDisputeEscrowTx(address!, escrowId), "Disputed", {
      success: "Escrow disputed",
      error: "Failed to dispute escrow",
    });

  const handleResolve = (toSeller: boolean) =>
    runTransaction(
      () => buildResolveDisputeTx(address!, escrowId, toSeller),
      "Resolved",
      {
        success: toSeller
          ? "Dispute resolved to seller"
          : "Dispute resolved to buyer",
        error: "Failed to resolve dispute",
      }
    );

  if (!address) {
    return (
      <Card className="text-center">
        <p className="text-zinc-600 dark:text-zinc-400">
          Connect your wallet to fund or release an escrow.
        </p>
      </Card>
    );
  }

  const statusLabel = getStatusLabel(escrow ?? null);
  const isCreated = statusLabel === "Created";
  const isFunded = statusLabel === "Funded";
  const isDisputed = statusLabel === "Disputed";
  const isBuyer = escrow?.buyer === address;
  const isSeller = escrow?.seller === address;
  const isArbitrator = escrow?.arbitrator === address;
  const refundAvailable = isFunded && escrow && now >= escrow.timeout_at;

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold">Pay via Escrow</h2>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`min-h-[44px] rounded-md px-3 py-1.5 text-sm font-medium ${
            mode === "manual"
              ? "bg-blue-600 text-white"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
          }`}
        >
          Manual
        </button>
        <button
          type="button"
          onClick={() => setMode("scan")}
          className={`min-h-[44px] rounded-md px-3 py-1.5 text-sm font-medium ${
            mode === "scan"
              ? "bg-blue-600 text-white"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
          }`}
        >
          Scan QR
        </button>
      </div>

      {mode === "scan" && (
        <div className="mb-4 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
          <Scanner
            onScan={handleScan}
            onError={(error: { message?: string }) =>
              setLookupError(error.message || "Camera error")
            }
            styles={{
              container: { width: "100%", aspectRatio: "1 / 1" },
            }}
          />
        </div>
      )}

      <form onSubmit={handleLookup} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="escrow-id"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Escrow ID
          </label>
          <input
            id="escrow-id"
            type="number"
            min="1"
            required
            value={escrowIdInput}
            onChange={(e) => {
              setEscrowIdInput(e.target.value);
              setEscrow(Number(e.target.value), null);
            }}
            placeholder="1"
            className="min-h-[44px] w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>

        <button
          type="submit"
          disabled={lookupLoading}
          className="min-h-[44px] rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-900 disabled:opacity-50"
        >
          {lookupLoading ? "Looking up..." : "Look Up Escrow"}
        </button>
      </form>

      {lookupLoading && !escrow && (
        <div className="mt-4 space-y-2">
          <SkeletonLoader className="h-4 w-3/4" />
          <SkeletonLoader className="h-4 w-1/2" />
        </div>
      )}

      {lookupError && (
        <div className="mt-4 flex items-center justify-between gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          <span>{lookupError}</span>
          <RetryButton onRetry={() => loadEscrow(escrowId)} />
        </div>
      )}

      {escrow && (
        <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Status</span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {statusLabel || "Unknown"}
            </span>
          </div>
          <div className="space-y-1 text-sm break-all">
            <p>Seller: {escrow.seller}</p>
            <p>Buyer: {escrow.buyer}</p>
            <p>Amount: {stroopsToXlm(escrow.amount)} XLM</p>
            {escrow.memo && <p>Memo: {escrow.memo}</p>}
            {escrow.timeout_at > 0 && (
              <p>
                Refund available after:{" "}
                {new Date(escrow.timeout_at * 1000).toLocaleString()}
              </p>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleFund}
              disabled={pending || !isCreated || !isBuyer}
              className="min-h-[44px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pending && isCreated ? "Funding..." : "Fund Escrow"}
            </button>
            <button
              type="button"
              onClick={handleRelease}
              disabled={pending || !isFunded || !isBuyer}
              className="min-h-[44px] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {pending && isFunded ? "Releasing..." : "Release to Seller"}
            </button>
            <button
              type="button"
              onClick={handleDispute}
              disabled={pending || !isFunded || (!isBuyer && !isSeller)}
              className="min-h-[44px] rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {pending && isFunded ? "Disputing..." : "Dispute"}
            </button>
            <button
              type="button"
              onClick={handleRefund}
              disabled={pending || !refundAvailable || !isBuyer}
              className="min-h-[44px] rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {pending && refundAvailable ? "Refunding..." : "Refund"}
            </button>
          </div>

          {isDisputed && isArbitrator && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleResolve(true)}
                disabled={pending}
                className="min-h-[44px] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Resolve to Seller
              </button>
              <button
                type="button"
                onClick={() => handleResolve(false)}
                disabled={pending}
                className="min-h-[44px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Resolve to Buyer
              </button>
            </div>
          )}
        </div>
      )}

      <TransactionStatus
        status={tx.status}
        hash={tx.hash}
        error={tx.error}
        successMessage={txMessage.success}
        errorMessage={txMessage.error}
      />
    </Card>
  );
}
