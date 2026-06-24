"use client";

import {
  getAddress,
  getNetwork,
  isAllowed,
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";
import { useCallback, useEffect, useState } from "react";
import { NETWORK_PASSPHRASE } from "@/lib/stellar";

export interface UseFreighterReturn {
  connected: boolean;
  address: string | null;
  network: string | null;
  loading: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  sign: (xdr: string) => Promise<string>;
  checkConnection: () => Promise<void>;
}

export function useFreighter(): UseFreighterReturn {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateConnection = useCallback(async () => {
    const connectedResult = await isConnected();
    if (!connectedResult.isConnected) {
      return false;
    }

    const allowedResult = await isAllowed();
    if (!allowedResult.isAllowed) {
      return false;
    }

    const addressResult = await getAddress();
    if (addressResult.error) {
      throw new Error(addressResult.error.message || "Failed to get address");
    }

    const networkResult = await getNetwork();
    if (networkResult.error) {
      throw new Error(networkResult.error.message || "Failed to get network");
    }

    setAddress(addressResult.address);
    setNetwork(networkResult.network);
    setConnected(true);
    return true;
  }, []);

  const checkConnection = useCallback(async () => {
    setError(null);
    try {
      const ok = await updateConnection();
      if (!ok) {
        setConnected(false);
        setAddress(null);
        setNetwork(null);
      }
    } catch (err: unknown) {
      setConnected(false);
      setAddress(null);
      setNetwork(null);
      if (err instanceof Error) {
        setError(err.message);
      }
    }
  }, [updateConnection]);

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const connectedResult = await isConnected();
      if (!connectedResult.isConnected) {
        throw new Error(
          "Freighter wallet not detected. Please install the Freighter extension and refresh the page."
        );
      }

      const accessResult = await requestAccess();
      if (accessResult.error) {
        throw new Error(accessResult.error.message || "Access request failed");
      }

      await checkConnection();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to connect wallet.");
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [checkConnection]);

  const disconnect = useCallback(() => {
    setConnected(false);
    setAddress(null);
    setNetwork(null);
    setError(null);
  }, []);

  const sign = useCallback(
    async (xdr: string): Promise<string> => {
      if (!connected || !address) {
        throw new Error("Wallet not connected");
      }

      const result = await signTransaction(xdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address,
      });

      if (result.error) {
        throw new Error(result.error.message || "Transaction signing failed");
      }

      return result.signedTxXdr;
    },
    [connected, address]
  );

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    // Initialize wallet state from the external Freighter browser extension.
    let cancelled = false;

    updateConnection()
      .then((ok) => {
        if (cancelled) return;
        if (!ok) {
          setConnected(false);
          setAddress(null);
          setNetwork(null);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setConnected(false);
        setAddress(null);
        setNetwork(null);
        if (err instanceof Error) {
          setError(err.message);
        }
      });

    return () => {
      cancelled = true;
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [updateConnection]);

  return {
    connected,
    address,
    network,
    loading,
    error,
    connect,
    disconnect,
    sign,
    checkConnection,
  };
}
