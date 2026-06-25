import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import { useWalletStore } from "@/store/walletStore";

const mockAuthModal = vi.fn();
const mockDisconnect = vi.fn();
const mockGetNetwork = vi.fn();
const mockSignTransaction = vi.fn();
const mockInit = vi.fn();

vi.mock("@creit.tech/stellar-wallets-kit/sdk", () => ({
  StellarWalletsKit: {
    init: (...args: unknown[]) => mockInit(...args),
    authModal: () => mockAuthModal(),
    disconnect: () => mockDisconnect(),
    getNetwork: () => mockGetNetwork(),
    signTransaction: (xdr: string, opts: unknown) =>
      mockSignTransaction(xdr, opts),
  },
}));

vi.mock("@creit.tech/stellar-wallets-kit", () => ({
  Networks: { TESTNET: "Test SDF Network ; September 2015" },
}));

vi.mock("@creit.tech/stellar-wallets-kit/modules/freighter", () => ({
  FreighterModule: class {},
}));
vi.mock("@creit.tech/stellar-wallets-kit/modules/lobstr", () => ({
  LobstrModule: class {},
}));
vi.mock("@creit.tech/stellar-wallets-kit/modules/xbull", () => ({
  xBullModule: class {},
}));
vi.mock("@creit.tech/stellar-wallets-kit/modules/albedo", () => ({
  AlbedoModule: class {},
}));

const ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHK3M";

describe("useStellarWallet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWalletStore.getState().clearWallet();
    mockAuthModal.mockResolvedValue({ address: ADDRESS });
    mockGetNetwork.mockResolvedValue({
      networkPassphrase: "Test SDF Network ; September 2015",
    });
  });

  it("initializes disconnected", () => {
    const { result } = renderHook(() => useStellarWallet());
    expect(result.current.connected).toBe(false);
    expect(result.current.address).toBeNull();
  });

  it("connects a wallet", async () => {
    const { result } = renderHook(() => useStellarWallet());

    await waitFor(() => expect(mockInit).toHaveBeenCalled());

    await act(async () => {
      await result.current.connect();
    });

    await waitFor(() => expect(result.current.connected).toBe(true));
    expect(result.current.address).toBe(ADDRESS);
  });

  it("disconnects a wallet", async () => {
    const { result } = renderHook(() => useStellarWallet());
    await waitFor(() => expect(mockInit).toHaveBeenCalled());

    await act(async () => {
      await result.current.connect();
    });
    await waitFor(() => expect(result.current.connected).toBe(true));

    await act(async () => {
      await result.current.disconnect();
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.address).toBeNull();
  });

  it("signs a transaction", async () => {
    mockSignTransaction.mockResolvedValue({ signedTxXdr: "signed-xdr" });
    const { result } = renderHook(() => useStellarWallet());
    await waitFor(() => expect(mockInit).toHaveBeenCalled());

    await act(async () => {
      await result.current.connect();
    });
    await waitFor(() => expect(result.current.connected).toBe(true));

    let signed = "";
    await act(async () => {
      signed = await result.current.sign("test-xdr");
    });

    expect(signed).toBe("signed-xdr");
  });
});
