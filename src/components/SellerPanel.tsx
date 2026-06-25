"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check } from "lucide-react";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import { buildEscrowQrString } from "@/lib/qr";
import { buildCreateEscrowTx } from "@/lib/transactions";
import { ESCROW_CONTRACT_ID } from "@/lib/stellar";
import { useTransaction } from "@/hooks/useTransaction";
import { Card } from "./Card";
import { TransactionStatus } from "./TransactionStatus";

export function SellerPanel() {
  const { address, sign } = useStellarWallet();
  const [buyer, setBuyer] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [arbitrator, setArbitrator] = useState("");
  const [escrowId, setEscrowId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    status,
    hash,
    error: txError,
    execute,
    reset,
  } = useTransaction(sign, {
    successMessage: "Escrow created",
  });

  const isBusy =
    status === "building" || status === "signing" || status === "submitting";

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !buyer || !amount) return;

    reset();
    setEscrowId(null);

    const result = await execute(async () => {
      const xdr = await buildCreateEscrowTx(
        address,
        address,
        buyer,
        amount,
        memo,
        arbitrator || undefined
      );
      return xdr;
    });

    if (result) {
      const returnedId =
        typeof result.result === "bigint"
          ? Number(result.result)
          : Number(result.result);
      if (!Number.isNaN(returnedId)) {
        setEscrowId(returnedId);
      }
    }
  };

  const handleCopy = async () => {
    if (escrowId === null || !ESCROW_CONTRACT_ID) return;
    const qrData = buildEscrowQrString({
      escrowId,
      contractId: ESCROW_CONTRACT_ID,
    });
    await navigator.clipboard.writeText(qrData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!address) {
    return (
      <Card className="text-center">
        <p className="text-zinc-600 dark:text-zinc-400">
          Connect your wallet to create an escrow payment request.
        </p>
      </Card>
    );
  }

  const qrValue =
    escrowId !== null && ESCROW_CONTRACT_ID
      ? buildEscrowQrString({ escrowId, contractId: ESCROW_CONTRACT_ID })
      : null;

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold">Create Escrow</h2>

      <form onSubmit={handleCreate} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="buyer"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Buyer Address
          </label>
          <input
            id="buyer"
            type="text"
            required
            value={buyer}
            onChange={(e) => setBuyer(e.target.value)}
            placeholder="G..."
            className="min-h-[44px] w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>

        <div>
          <label
            htmlFor="amount"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Amount (XLM)
          </label>
          <input
            id="amount"
            type="number"
            step="0.0000001"
            min="0.0000001"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="10"
            className="min-h-[44px] w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>

        <div>
          <label
            htmlFor="memo"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Memo (optional)
          </label>
          <input
            id="memo"
            type="text"
            maxLength={28}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Invoice #123"
            className="min-h-[44px] w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>

        <div>
          <label
            htmlFor="arbitrator"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Arbitrator (optional)
          </label>
          <input
            id="arbitrator"
            type="text"
            value={arbitrator}
            onChange={(e) => setArbitrator(e.target.value)}
            placeholder="G..."
            className="min-h-[44px] w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>

        <button
          type="submit"
          disabled={isBusy}
          className="min-h-[44px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isBusy ? "Creating..." : "Create Escrow"}
        </button>
      </form>

      <TransactionStatus status={status} hash={hash} error={txError} />

      {qrValue && (
        <div className="mt-6 flex flex-col items-center gap-3">
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
            <QRCodeSVG value={qrValue} size={256} level="H" includeMargin />
          </div>

          <p className="text-sm font-medium">Escrow #{escrowId}</p>

          <div className="w-full">
            <p className="mb-1 text-xs text-zinc-500">Payment QR data:</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={qrValue}
                className="flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs break-all dark:border-zinc-700 dark:bg-zinc-800"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> Copy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
