export type TransactionStatus =
  | "idle"
  | "building"
  | "signing"
  | "submitting"
  | "success"
  | "error";

interface TransactionStatusProps {
  status: TransactionStatus;
  hash?: string;
  error?: string | null;
}

export function TransactionStatus({
  status,
  hash,
  error,
}: TransactionStatusProps) {
  if (status === "idle") return null;

  return (
    <div className="mt-4 rounded-lg border p-3 text-sm">
      {status === "building" && (
        <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
          <span className="animate-pulse">⏳</span> Building transaction...
        </div>
      )}

      {status === "signing" && (
        <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
          <span className="animate-pulse">✍️</span> Waiting for wallet signature...
        </div>
      )}

      {status === "submitting" && (
        <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
          <span className="animate-pulse">🚀</span> Submitting to Stellar...
        </div>
      )}

      {status === "success" && hash && (
        <div className="flex flex-col gap-1 text-emerald-700 dark:text-emerald-400">
          <div className="flex items-center gap-2">
            <span>✅</span> Payment sent successfully!
          </div>
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-blue-600 hover:underline dark:text-blue-400"
          >
            View transaction: {hash}
          </a>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col gap-1 text-red-600 dark:text-red-400">
          <div className="flex items-center gap-2">
            <span>❌</span> Payment failed
          </div>
          {error && (
            <p className="text-xs">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
