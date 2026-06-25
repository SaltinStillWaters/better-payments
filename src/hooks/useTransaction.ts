"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  parseContractError,
  type SorobanSubmitResult,
} from "@/lib/transactions";

export type TransactionPhase =
  | "idle"
  | "building"
  | "signing"
  | "submitting"
  | "success"
  | "error";

interface UseTransactionOptions {
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: (hash: string) => void;
}

export interface TransactionState {
  status: TransactionPhase;
  hash: string | undefined;
  result: unknown | undefined;
  error: string | null;
}

export function useTransaction(
  sign: (xdr: string) => Promise<string>,
  options: UseTransactionOptions = {}
) {
  const {
    successMessage = "Transaction submitted",
    errorMessage,
    onSuccess,
  } = options;

  const [state, setState] = useState<TransactionState>({
    status: "idle",
    hash: undefined,
    result: undefined,
    error: null,
  });

  const execute = useCallback(
    async (
      buildTx: () => Promise<string>
    ): Promise<SorobanSubmitResult | null> => {
      setState({
        status: "building",
        hash: undefined,
        result: undefined,
        error: null,
      });

      const run = async (attempt: number): Promise<SorobanSubmitResult> => {
        try {
          const xdr = await buildTx();
          setState((s) => ({ ...s, status: "signing" }));
          const signedXdr = await sign(xdr);
          setState((s) => ({ ...s, status: "submitting" }));

          const { submitSorobanTransaction } =
            await import("@/lib/transactions");
          const outcome = await submitSorobanTransaction(signedXdr);

          setState({
            status: "success",
            hash: outcome.hash,
            result: outcome.result,
            error: null,
          });
          toast.success(successMessage, {
            description: `Transaction ${outcome.hash.slice(0, 8)}... submitted`,
          });
          onSuccess?.(outcome.hash);
          return outcome;
        } catch (err: unknown) {
          const isRejection =
            err instanceof Error &&
            err.message.toLowerCase().includes("rejected");

          if (isRejection) {
            const msg = "Transaction was rejected in wallet.";
            setState({
              status: "error",
              hash: undefined,
              result: undefined,
              error: msg,
            });
            toast.error(errorMessage || msg);
            throw new Error(msg);
          }

          // Retry on transient RPC errors up to 3 times.
          if (attempt < 3) {
            const delay = Math.min(1000 * 2 ** attempt, 8000);
            await new Promise((resolve) => setTimeout(resolve, delay));
            return run(attempt + 1);
          }

          const msg = parseContractError(err);
          setState({
            status: "error",
            hash: undefined,
            result: undefined,
            error: msg,
          });
          toast.error(errorMessage || msg);
          throw new Error(msg);
        }
      };

      try {
        return await run(1);
      } catch {
        return null;
      }
    },
    [sign, successMessage, errorMessage, onSuccess]
  );

  const reset = useCallback(() => {
    setState({
      status: "idle",
      hash: undefined,
      result: undefined,
      error: null,
    });
  }, []);

  return { ...state, execute, reset };
}
