"use client";

import { useState } from "react";
import { ConnectButton } from "@/components/ConnectButton";
import { BalanceDisplay } from "@/components/BalanceDisplay";
import { SellerPanel } from "@/components/SellerPanel";
import { BuyerPanel } from "@/components/BuyerPanel";
import { EventLog } from "@/components/EventLog";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import { NETWORK_PASSPHRASE } from "@/lib/stellar";

type Mode = "seller" | "buyer";

export default function Home() {
  const [mode, setMode] = useState<Mode>("seller");
  const { error, network, connected } = useStellarWallet();

  const networkMismatch =
    connected && network && network !== NETWORK_PASSPHRASE;

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 py-8 dark:bg-zinc-950">
      <header className="mb-8 flex w-full max-w-md flex-col items-center gap-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Better Payments
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Escrow payments on Stellar Testnet
          </p>
        </div>
        <ConnectButton />
        <BalanceDisplay />

        {error && (
          <div className="w-full rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        {networkMismatch && (
          <div className="w-full rounded-lg border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            Please switch your wallet to Testnet.
          </div>
        )}
      </header>

      <main className="w-full max-w-md">
        <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => setMode("seller")}
            className={`rounded-lg py-2 text-sm font-medium transition-colors ${
              mode === "seller"
                ? "bg-blue-600 text-white"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            Receive
          </button>
          <button
            type="button"
            onClick={() => setMode("buyer")}
            className={`rounded-lg py-2 text-sm font-medium transition-colors ${
              mode === "buyer"
                ? "bg-blue-600 text-white"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            Pay
          </button>
        </div>

        {mode === "seller" ? <SellerPanel /> : <BuyerPanel />}

        <EventLog />
      </main>

      <footer className="mt-8 text-center text-xs text-zinc-400 dark:text-zinc-600">
        Connected to Stellar Testnet via multi-wallet kit
      </footer>
    </div>
  );
}
