"use client";

import { useCallback, useEffect, useState } from "react";

export interface UseStellarWalletReturn {
  connected: boolean;
  address: string | null;
  network: string | null;
  loading: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sign: (xdr: string) => Promise<string>;
}

export function useStellarWallet(): UseStellarWalletReturn {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Lazy-init the wallets kit once on the client to avoid SSR issues.
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const { StellarWalletsKit } = await import(
          "@creit.tech/stellar-wallets-kit/sdk"
        );
        const { Networks } = await import("@creit.tech/stellar-wallets-kit");
        const { FreighterModule } = await import(
          "@creit.tech/stellar-wallets-kit/modules/freighter"
        );
        const { LobstrModule } = await import(
          "@creit.tech/stellar-wallets-kit/modules/lobstr"
        );
        const { xBullModule } = await import(
          "@creit.tech/stellar-wallets-kit/modules/xbull"
        );
        const { AlbedoModule } = await import(
          "@creit.tech/stellar-wallets-kit/modules/albedo"
        );

        if (cancelled) return;

        StellarWalletsKit.init({
          modules: [
            new FreighterModule(),
            new LobstrModule(),
            new xBullModule(),
            new AlbedoModule(),
          ],
          network: Networks.TESTNET,
          selectedWalletId: undefined,
        });

        setReady(true);
      } catch (err: unknown) {
        if (!cancelled) {
          if (err instanceof Error) {
            setError(err.message);
          } else {
            setError("Failed to initialize wallet kit");
          }
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    if (!ready) {
      setError("Wallet kit is not ready yet");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { StellarWalletsKit } = await import(
        "@creit.tech/stellar-wallets-kit/sdk"
      );
      const { address: addr } = await StellarWalletsKit.authModal();
      const networkResult = await StellarWalletsKit.getNetwork().catch(() => null);

      setAddress(addr);
      setNetwork(networkResult?.networkPassphrase ?? null);
      setConnected(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to connect wallet");
      }
    } finally {
      setLoading(false);
    }
  }, [ready]);

  const disconnect = useCallback(async () => {
    try {
      const { StellarWalletsKit } = await import(
        "@creit.tech/stellar-wallets-kit/sdk"
      );
      await StellarWalletsKit.disconnect();
    } catch (err: unknown) {
      console.error("Disconnect error:", err);
    } finally {
      setConnected(false);
      setAddress(null);
      setNetwork(null);
      setError(null);
    }
  }, []);

  const sign = useCallback(async (xdr: string): Promise<string> => {
    if (!connected || !address) {
      throw new Error("Wallet not connected");
    }

    const { StellarWalletsKit } = await import(
      "@creit.tech/stellar-wallets-kit/sdk"
    );
    const { Networks } = await import("@creit.tech/stellar-wallets-kit");

    const result = await StellarWalletsKit.signTransaction(xdr, {
      networkPassphrase: Networks.TESTNET,
      address,
    });

    return result.signedTxXdr;
  }, [connected, address]);

  return {
    connected,
    address,
    network,
    loading,
    error,
    connect,
    disconnect,
    sign,
  };
}
