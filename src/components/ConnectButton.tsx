"use client";

import { useFreighter } from "@/hooks/useFreighter";
import { truncateAddress } from "@/lib/stellar";

export function ConnectButton() {
  const { connected, address, loading, connect, disconnect } = useFreighter();

  const handleClick = async () => {
    if (connected) {
      disconnect();
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
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
    >
      {loading ? (
        "Connecting..."
      ) : connected ? (
        <>
          <span className="mr-2">🔵</span>
          {address ? truncateAddress(address) : "Connected"}
        </>
      ) : (
        "Connect Freighter"
      )}
    </button>
  );
}
