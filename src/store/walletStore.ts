"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface WalletState {
  connected: boolean;
  address: string | null;
  network: string | null;
  walletType: string | null;
  autoReconnect: boolean;
  isReconnecting: boolean;
  error: string | null;
  setWallet: (payload: {
    address: string;
    network: string;
    walletType: string;
  }) => void;
  clearWallet: () => void;
  setReconnecting: (value: boolean) => void;
  setError: (error: string | null) => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      connected: false,
      address: null,
      network: null,
      walletType: null,
      autoReconnect: false,
      isReconnecting: false,
      error: null,
      setWallet: ({ address, network, walletType }) =>
        set({
          connected: true,
          address,
          network,
          walletType,
          autoReconnect: true,
          isReconnecting: false,
          error: null,
        }),
      clearWallet: () =>
        set({
          connected: false,
          address: null,
          network: null,
          walletType: null,
          autoReconnect: false,
          isReconnecting: false,
          error: null,
        }),
      setReconnecting: (value) => set({ isReconnecting: value }),
      setError: (error) => set({ error }),
    }),
    {
      name: "better-payments-wallet",
      partialize: (state) => ({
        address: state.address,
        network: state.network,
        walletType: state.walletType,
        autoReconnect: state.autoReconnect,
      }),
    }
  )
);
