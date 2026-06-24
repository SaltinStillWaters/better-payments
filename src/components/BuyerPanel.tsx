"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import { parseEscrowQrString } from "@/lib/qr";
import {
  buildFundEscrowTx,
  buildReleaseEscrowTx,
  EscrowState,
  getEscrowState,
  parseContractError,
  submitSorobanTransaction,
} from "@/lib/transactions";
import { stroopsToXlm } from "@/lib/stellar";
import { TransactionStatus } from "./TransactionStatus";

const Scanner = dynamic(
  () => import("@yudiel/react-qr-scanner").then((mod) => mod.Scanner),
  { ssr: false }
);

export function BuyerPanel() {
  const { address, sign } = useStellarWallet();
  const [mode, setMode] = useState<"manual" | "scan">("manual");
  const [escrowId, setEscrowId] = useState("");
  const [escrow, setEscrow] = useState<EscrowState | null>(null);
  const [status, setStatus] = useState<
    "idle" | "building" | "signing" | "submitting" | "success" | "error"
  >("idle");
  const [hash, setHash] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const handleScan = (result: Array<{ rawValue: string }> | undefined) => {
    const value = result?.[0]?.rawValue;
    if (!value) return;

    const params = parseEscrowQrString(value);
    if (!params) {
      setError("Invalid payment QR code");
      return;
    }

    setEscrowId(params.escrowId.toString());
    setMode("manual");
    setError(null);
    void loadEscrow(params.escrowId);
  };

  const loadEscrow = async (id: number) => {
    setEscrow(null);
    try {
      const state = await getEscrowState(id);
      setEscrow(state);
    } catch (err: unknown) {
      console.error("Failed to load escrow:", err);
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = Number(escrowId);
    if (Number.isNaN(id) || id <= 0) {
      setError("Invalid escrow ID");
      return;
    }
    setError(null);
    await loadEscrow(id);
  };

  const handleFund = async () => {
    if (!address || !escrow) return;
    const id = Number(escrowId);

    setStatus("building");
    setError(null);
    setHash(undefined);

    try {
      const xdr = await buildFundEscrowTx(address, id);
      setStatus("signing");
      const signedXdr = await sign(xdr);
      setStatus("submitting");
      const result = await submitSorobanTransaction(signedXdr);
      setHash(result.hash);
      setStatus("success");
      await loadEscrow(id);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("rejected")) {
        setError("Transaction was rejected in wallet.");
      } else {
        setError(parseContractError(err));
      }
      setStatus("error");
    }
  };

  const handleRelease = async () => {
    if (!address || !escrow) return;
    const id = Number(escrowId);

    setStatus("building");
    setError(null);
    setHash(undefined);

    try {
      const xdr = await buildReleaseEscrowTx(address, id);
      setStatus("signing");
      const signedXdr = await sign(xdr);
      setStatus("submitting");
      const result = await submitSorobanTransaction(signedXdr);
      setHash(result.hash);
      setStatus("success");
      await loadEscrow(id);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("rejected")) {
        setError("Transaction was rejected in wallet.");
      } else {
        setError(parseContractError(err));
      }
      setStatus("error");
    }
  };

  const getStatusLabel = () => {
    if (!escrow) return null;
    const statusValue =
      typeof escrow.status === "string" ? escrow.status : escrow.status.tag;
    return statusValue;
  };

  if (!address) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-zinc-600 dark:text-zinc-400">
          Connect your wallet to fund or release an escrow.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-lg font-semibold">Pay via Escrow</h2>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
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
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
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
              setError(error.message || "Camera error")
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
            value={escrowId}
            onChange={(e) => {
              setEscrowId(e.target.value);
              setEscrow(null);
            }}
            placeholder="1"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>

        <button
          type="submit"
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-900"
        >
          Look Up Escrow
        </button>
      </form>

      {escrow && (
        <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Status</span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {getStatusLabel()}
            </span>
          </div>
          <div className="space-y-1 text-sm">
            <p>Seller: {escrow.seller}</p>
            <p>Buyer: {escrow.buyer}</p>
            <p>Amount: {stroopsToXlm(escrow.amount)} XLM</p>
            {escrow.memo && <p>Memo: {escrow.memo}</p>}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleFund}
              disabled={
                status === "building" ||
                status === "signing" ||
                status === "submitting" ||
                getStatusLabel() !== "Created"
              }
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Fund Escrow
            </button>
            <button
              type="button"
              onClick={handleRelease}
              disabled={
                status === "building" ||
                status === "signing" ||
                status === "submitting" ||
                getStatusLabel() !== "Funded"
              }
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Release to Seller
            </button>
          </div>
        </div>
      )}

      <TransactionStatus status={status} hash={hash} error={error} />
    </div>
  );
}
