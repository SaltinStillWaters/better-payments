"use client";

import { useEffect, useState } from "react";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import { getBalance } from "@/lib/balance";
import { fundWithFriendbot } from "@/lib/stellar";

export function BalanceDisplay() {
  const { address } = useStellarWallet();
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [funding, setFunding] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    // Synchronizes React state with the on-chain XLM balance when the
    // connected wallet address changes.
    let cancelled = false;

    if (!address) {
      setBalance(null);
      return;
    }

    setLoading(true);
    setError(null);

    getBalance(address)
      .then((bal) => {
        if (!cancelled) setBalance(bal);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          if (err instanceof Error) {
            setError(err.message);
          } else {
            setError("Failed to fetch balance");
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [address]);

  const handleFund = async () => {
    if (!address) return;

    setFunding(true);
    setError(null);

    try {
      await fundWithFriendbot(address);
      const bal = await getBalance(address);
      setBalance(bal);
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

  const handleRefresh = async () => {
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
        setError("Failed to refresh balance");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!address) {
    return null;
  }

  const isUnfunded = balance === "0";

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-sm text-zinc-500 dark:text-zinc-400">XLM Balance</div>
      <div className="text-2xl font-semibold">
        {loading ? (
          "Loading..."
        ) : balance !== null ? (
          <>{Number(balance).toLocaleString()} XLM</>
        ) : (
          "—"
        )}
      </div>

      {isUnfunded && (
        <button
          onClick={handleFund}
          disabled={funding}
          className="mt-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {funding ? "Funding..." : "Fund with Friendbot"}
        </button>
      )}

      {!isUnfunded && (
        <button
          onClick={() => void handleRefresh()}
          disabled={loading}
          className="text-xs text-blue-600 hover:underline disabled:opacity-50"
        >
          Refresh
        </button>
      )}

      {error && (
        <p className="max-w-xs text-center text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
