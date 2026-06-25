"use client";

import { useEffect, useState } from "react";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import { getBalance } from "@/lib/balance";
import { fundWithFriendbot } from "@/lib/stellar";
import { SkeletonLoader } from "./SkeletonLoader";
import { RetryButton } from "./RetryButton";

export function BalanceDisplay() {
  const { address } = useStellarWallet();
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [funding, setFunding] = useState(false);

  const loadBalance = async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const bal = await getBalance(address);
      setBalance(bal);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to fetch balance");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!address) {
      setBalance(null);
      setError(null);
      return;
    }

    loadBalance();
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const handleFund = async () => {
    if (!address) return;

    setFunding(true);
    setError(null);

    try {
      await fundWithFriendbot(address);
      await loadBalance();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Funding failed");
      }
    } finally {
      setFunding(false);
    }
  };

  if (!address) {
    return null;
  }

  const isUnfunded = balance === "0";

  return (
    <div className="flex w-full flex-col items-center gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        XLM Balance
      </div>
      <div className="text-2xl font-semibold">
        {loading ? (
          <SkeletonLoader className="h-8 w-32" />
        ) : balance !== null ? (
          <>{Number(balance).toLocaleString()} XLM</>
        ) : (
          "—"
        )}
      </div>

      {isUnfunded && (
        <button
          type="button"
          onClick={handleFund}
          disabled={funding}
          className="mt-1 min-h-[44px] rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {funding ? "Funding..." : "Fund with Friendbot"}
        </button>
      )}

      {!isUnfunded && <RetryButton onRetry={loadBalance} label="Refresh" />}

      {error && (
        <p className="max-w-xs text-center text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
