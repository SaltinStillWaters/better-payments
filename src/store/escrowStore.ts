"use client";

import { create } from "zustand";
import { EscrowState } from "@/lib/transactions";

export type EscrowCache = Record<number, EscrowState | null>;

export interface EscrowStore {
  escrows: EscrowCache;
  pending: Record<number, boolean>;
  setEscrow: (id: number, state: EscrowState | null) => void;
  setPending: (id: number, pending: boolean) => void;
  optimisticStatus: (id: number, status: EscrowState["status"]) => void;
}

export const useEscrowStore = create<EscrowStore>()((set) => ({
  escrows: {},
  pending: {},
  setEscrow: (id, state) =>
    set((prev) => ({
      escrows: { ...prev.escrows, [id]: state },
    })),
  setPending: (id, pending) =>
    set((prev) => ({
      pending: { ...prev.pending, [id]: pending },
    })),
  optimisticStatus: (id, status) =>
    set((prev) => {
      const current = prev.escrows[id];
      if (!current) return prev;
      return {
        escrows: {
          ...prev.escrows,
          [id]: { ...current, status },
        },
      };
    }),
}));
