"use client";

import { Wallet } from "lucide-react";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import { truncateAddress } from "@/lib/stellar";

export function ConnectButton() {
  const { connected, address, loading, connect, disconnect } =
    useStellarWallet();

  const handleClick = async () => {
    if (connected) {
      await disconnect();
      return;
    }

    try {
      await connect();
    } catch {
      // Error is already captured in the hook state.
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
    >
      {loading ? (
        "Connecting..."
      ) : connected ? (
        <>
          <Wallet className="mr-2 h-4 w-4" aria-hidden="true" />
          {address ? truncateAddress(address) : "Connected"}
        </>
      ) : (
        "Connect Wallet"
      )}
    </button>
  );
}
