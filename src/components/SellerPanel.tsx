"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useFreighter } from "@/hooks/useFreighter";
import { buildSep7PayUri } from "@/lib/qr";

export function SellerPanel() {
  const { address } = useFreighter();
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [uri, setUri] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !amount) return;

    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return;
    }

    const paymentUri = buildSep7PayUri({
      destination: address,
      amount: parsedAmount.toString(),
      memo,
    });

    setUri(paymentUri);
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!uri) return;
    await navigator.clipboard.writeText(uri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!address) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-zinc-600 dark:text-zinc-400">
          Connect your Freighter wallet to generate payment QR codes.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-lg font-semibold">Receive Payment</h2>

      <form onSubmit={handleGenerate} className="flex flex-col gap-4">
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
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
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
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>

        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Generate QR Code
        </button>
      </form>

      {uri && (
        <div className="mt-6 flex flex-col items-center gap-3">
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
            <QRCodeSVG value={uri} size={256} level="H" includeMargin />
          </div>

          <div className="w-full">
            <p className="mb-1 text-xs text-zinc-500">Payment URI:</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={uri}
                className="flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs break-all dark:border-zinc-700 dark:bg-zinc-800"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
