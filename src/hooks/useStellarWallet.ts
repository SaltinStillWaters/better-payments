"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWalletStore } from "@/store/walletStore";

export interface UseStellarWalletReturn {
  connected: boolean;
  address: string | null;
  network: string | null;
  loading: boolean;
  isReconnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sign: (xdr: string) => Promise<string>;
}

export function useStellarWallet(): UseStellarWalletReturn {
  const {
    connected,
    address,
    network,
    walletType,
    autoReconnect,
    isReconnecting,
    error: storeError,
    setWallet,
    clearWallet,
    setReconnecting,
    setError,
  } = useWalletStore();

  const [ready, setReady] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const initStarted = useRef(false);
  const reconnectStarted = useRef(false);

  // Lazy-init the wallets kit once on the client to avoid SSR issues.
  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;

    let cancelled = false;

    const init = async () => {
      try {
        const { StellarWalletsKit } =
          await import("@creit.tech/stellar-wallets-kit/sdk");
        const { Networks } = await import("@creit.tech/stellar-wallets-kit");
        const { FreighterModule } =
          await import("@creit.tech/stellar-wallets-kit/modules/freighter");
        const { LobstrModule } =
          await import("@creit.tech/stellar-wallets-kit/modules/lobstr");
        const { xBullModule } =
          await import("@creit.tech/stellar-wallets-kit/modules/xbull");
        const { AlbedoModule } =
          await import("@creit.tech/stellar-wallets-kit/modules/albedo");

        if (cancelled) return;

        StellarWalletsKit.init({
          modules: [
            new FreighterModule(),
            new LobstrModule(),
            new xBullModule(),
            new AlbedoModule(),
          ],
          network: Networks.TESTNET,
          selectedWalletId: walletType ?? undefined,
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
      initStarted.current = false;
    };
  }, [walletType, setError]);

  // Attempt a silent reconnect when the kit is ready and we have a persisted wallet.
  useEffect(() => {
    if (!ready || !autoReconnect || connected || !address) return;
    if (reconnectStarted.current) return;
    reconnectStarted.current = true;

    let cancelled = false;

    const reconnect = async () => {
      setReconnecting(true);
      try {
        const { StellarWalletsKit } =
          await import("@creit.tech/stellar-wallets-kit/sdk");
        const { address: reconnectedAddress } =
          await StellarWalletsKit.authModal();
        const networkResult = await StellarWalletsKit.getNetwork().catch(
          () => null
        );

        if (cancelled) return;

        setWallet({
          address: reconnectedAddress,
          network: networkResult?.networkPassphrase ?? network ?? "",
          walletType: walletType ?? "",
        });
      } catch (err: unknown) {
        if (!cancelled) {
          clearWallet();
          if (err instanceof Error) {
            setError(err.message);
          }
        }
      } finally {
        if (!cancelled) setReconnecting(false);
      }
    };

    void reconnect();

    return () => {
      cancelled = true;
    };
  }, [
    ready,
    autoReconnect,
    connected,
    address,
    network,
    walletType,
    setWallet,
    clearWallet,
    setReconnecting,
    setError,
  ]);

  const connect = useCallback(async () => {
    if (!ready) {
      setError("Wallet kit is not ready yet");
      return;
    }

    setLocalLoading(true);
    setError(null);

    try {
      const { StellarWalletsKit } =
        await import("@creit.tech/stellar-wallets-kit/sdk");
      const { address: addr } = await StellarWalletsKit.authModal();
      const networkResult = await StellarWalletsKit.getNetwork().catch(
        () => null
      );

      setWallet({
        address: addr,
        network: networkResult?.networkPassphrase ?? "",
        walletType: "",
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to connect wallet");
      }
    } finally {
      setLocalLoading(false);
    }
  }, [ready, setWallet, setError]);

  const disconnect = useCallback(async () => {
    try {
      const { StellarWalletsKit } =
        await import("@creit.tech/stellar-wallets-kit/sdk");
      await StellarWalletsKit.disconnect();
    } catch (err: unknown) {
      // Ignore disconnect errors; clear local state regardless.
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      clearWallet();
    }
  }, [clearWallet, setError]);

  const sign = useCallback(
    async (xdr: string): Promise<string> => {
      if (!connected || !address) {
        throw new Error("Wallet not connected");
      }

      const { StellarWalletsKit } =
        await import("@creit.tech/stellar-wallets-kit/sdk");
      const { Networks } = await import("@creit.tech/stellar-wallets-kit");

      const result = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: Networks.TESTNET,
        address,
      });

      return result.signedTxXdr;
    },
    [connected, address]
  );

  return {
    connected,
    address,
    network,
    loading: localLoading || isReconnecting,
    isReconnecting,
    error: storeError,
    connect,
    disconnect,
    sign,
  };
}
