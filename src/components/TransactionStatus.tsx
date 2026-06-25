import { CheckCircle2, Loader2, PenTool, Rocket, XCircle } from "lucide-react";

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
    <div
      role="status"
      aria-live="polite"
      className="mt-4 rounded-lg border p-3 text-sm"
    >
      {status === "building" && (
        <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Building transaction...
        </div>
      )}

      {status === "signing" && (
        <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
          <PenTool className="h-4 w-4 animate-pulse" aria-hidden="true" />
          Waiting for wallet signature...
        </div>
      )}

      {status === "submitting" && (
        <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
          <Rocket className="h-4 w-4 animate-pulse" aria-hidden="true" />
          Submitting to Stellar...
        </div>
      )}

      {status === "success" && hash && (
        <div className="flex flex-col gap-1 text-emerald-700 dark:text-emerald-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Payment sent successfully!
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
            <XCircle className="h-4 w-4" aria-hidden="true" />
            Payment failed
          </div>
          {error && <p className="text-xs">{error}</p>}
        </div>
      )}
    </div>
  );
}
