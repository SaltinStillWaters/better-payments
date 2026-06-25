"use client";

import { useCallback, useState } from "react";
import { RotateCcw } from "lucide-react";

interface RetryButtonProps {
  onRetry: () => void | Promise<void>;
  label?: string;
  className?: string;
}

export function RetryButton({
  onRetry,
  label = "Retry",
  className,
}: RetryButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    setLoading(true);
    try {
      await onRetry();
    } finally {
      setLoading(false);
    }
  }, [onRetry]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 ${className ?? ""}`}
    >
      <RotateCcw className="h-3 w-3" aria-hidden="true" />
      {loading ? "Retrying..." : label}
    </button>
  );
}
