"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useFreighter } from "@/hooks/useFreighter";
import { buildPaymentTx, parseHorizonError, submitTransaction } from "@/lib/transactions";
import { parseSep7PayUri } from "@/lib/qr";
import { TransactionStatus, TransactionStatus as TxStatus } from "./TransactionStatus";

const Scanner = dynamic(
  () => import("@yudiel/react-qr-scanner").then((mod) => mod.Scanner),
  { ssr: false }
);

export function BuyerPanel() {
  const { address, sign } = useFreighter();
  const [mode, setMode] = useState<"manual" | "scan">("manual");
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<TxStatus>("idle");
  const [hash, setHash] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const handleScan = (result: Array<{ rawValue: string }> | undefined) => {
    const value = result?.[0]?.rawValue;
    if (!value) return;

    const params = parseSep7PayUri(value);
    if (!params) {
      setError("Invalid payment QR code");
      return;
    }

    setDestination(params.destination);
    setAmount(params.amount);
    setMode("manual");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !destination || !amount) return;

    setStatus("building");
    setError(null);
    setHash(undefined);

    try {
      const xdr = await buildPaymentTx(address, destination, amount);
      setStatus("signing");
      const signedXdr = await sign(xdr);
      setStatus("submitting");
      const result = await submitTransaction(signedXdr);
      setHash(result.hash);
      setStatus("success");
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("rejected")) {
        setError("Transaction was rejected in wallet.");
      } else {
        setError(parseHorizonError(err));
      }
      setStatus("error");
    }
  };

  if (!address) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-zinc-600 dark:text-zinc-400">
          Connect your Freighter wallet to send payments.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-lg font-semibold">Send Payment</h2>

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

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="destination"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Destination Address
          </label>
          <input
            id="destination"
            type="text"
            required
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="G..."
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>

        <div>
          <label
            htmlFor="pay-amount"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Amount (XLM)
          </label>
          <input
            id="pay-amount"
            type="number"
            step="0.0000001"
            min="0.0000001"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="10"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>

        <button
          type="submit"
          disabled={status !== "idle" && status !== "error" && status !== "success"}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Pay
        </button>
      </form>

      <TransactionStatus status={status} hash={hash} error={error} />
    </div>
  );
}
