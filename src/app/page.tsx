"use client";

import { useState } from "react";
import { ConnectButton } from "@/components/ConnectButton";
import { BalanceDisplay } from "@/components/BalanceDisplay";
import { SellerPanel } from "@/components/SellerPanel";
import { BuyerPanel } from "@/components/BuyerPanel";
import { EventLog } from "@/components/EventLog";
import { Container } from "@/components/Container";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import { NETWORK_PASSPHRASE } from "@/lib/stellar";

type Mode = "seller" | "buyer";

export default function Home() {
  const [mode, setMode] = useState<Mode>("seller");
  const { error, network, connected } = useStellarWallet();

  const networkMismatch =
    connected && network && network !== NETWORK_PASSPHRASE;

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 py-6 dark:bg-zinc-950 sm:px-6 sm:py-8 lg:px-8">
      <Container>
        <header className="mb-6 flex w-full flex-col items-center gap-4 sm:mb-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white sm:text-3xl">
              Better Payments
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Escrow payments on Stellar Testnet
            </p>
          </div>
          <ConnectButton />
          <BalanceDisplay />

          {error && (
            <div
              role="alert"
              className="w-full rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
            >
              {error}
            </div>
          )}

          {networkMismatch && (
            <div
              role="alert"
              className="w-full rounded-lg border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
            >
              Please switch your wallet to Testnet.
            </div>
          )}
        </header>

        <main className="w-full">
          <div className="mx-auto mb-6 grid max-w-md grid-cols-2 gap-2 rounded-xl border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:max-w-lg">
            <button
              type="button"
              onClick={() => setMode("seller")}
              className={`min-h-[44px] rounded-lg py-2 text-sm font-medium transition-colors ${
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
              className={`min-h-[44px] rounded-lg py-2 text-sm font-medium transition-colors ${
                mode === "buyer"
                  ? "bg-blue-600 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              Pay
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className={mode === "seller" ? "block" : "hidden lg:block"}>
              <SellerPanel />
            </div>
            <div className={mode === "buyer" ? "block" : "hidden lg:block"}>
              <BuyerPanel />
            </div>
          </div>

          <EventLog />
        </main>

        <footer className="mt-8 text-center text-xs text-zinc-400 dark:text-zinc-600">
          Connected to Stellar Testnet via multi-wallet kit
        </footer>
      </Container>
    </div>
  );
}
