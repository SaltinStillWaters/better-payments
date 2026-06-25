import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BuyerPanel } from "./BuyerPanel";
import { useEscrowStore } from "@/store/escrowStore";
import { getEscrowState } from "@/lib/transactions";

const mockSign = vi.fn();
const mockExecute = vi.fn();

let mockAddress: string | null = "GBUYER";

vi.mock("@/hooks/useStellarWallet", () => ({
  useStellarWallet: () => ({ address: mockAddress, sign: mockSign }),
}));

vi.mock("@/hooks/useTransaction", () => ({
  useTransaction: () => ({
    status: "idle",
    hash: undefined,
    error: null,
    execute: mockExecute,
    reset: vi.fn(),
  }),
}));

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

vi.mock("@/lib/transactions", () => ({
  getEscrowState: vi.fn(),
  buildFundEscrowTx: vi.fn().mockResolvedValue("xdr"),
  buildReleaseEscrowTx: vi.fn().mockResolvedValue("xdr"),
  buildRefundEscrowTx: vi.fn().mockResolvedValue("xdr"),
  buildDisputeEscrowTx: vi.fn().mockResolvedValue("xdr"),
  buildResolveDisputeTx: vi.fn().mockResolvedValue("xdr"),
}));

vi.mock("@/lib/stellar", () => ({
  stroopsToXlm: (v: bigint | string) => String(v),
}));

function resetStore() {
  useEscrowStore.setState({ escrows: {}, pending: {} });
}

describe("BuyerPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddress = "GBUYER";
    resetStore();
  });

  it("prompts to connect when no wallet", () => {
    mockAddress = null;
    render(<BuyerPanel />);
    expect(
      screen.getByText(/connect your wallet to fund or release/i)
    ).toBeInTheDocument();
  });

  it("renders the lookup form when connected", () => {
    render(<BuyerPanel />);
    expect(screen.getByLabelText(/escrow id/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /look up escrow/i })
    ).toBeInTheDocument();
  });

  it("shows an error banner when lookup fails", async () => {
    vi.mocked(getEscrowState).mockRejectedValue(new Error("EscrowNotFound"));
    render(<BuyerPanel />);

    fireEvent.change(screen.getByLabelText(/escrow id/i), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: /look up escrow/i }));

    await waitFor(() =>
      expect(screen.getByText(/escrownotfound/i)).toBeInTheDocument()
    );
  });

  it("renders escrow details and action buttons after lookup", async () => {
    vi.mocked(getEscrowState).mockResolvedValue({
      seller: "GSELLER",
      buyer: "GBUYER",
      amount: 100000000n,
      memo: "test",
      status: { tag: "Created" },
      timeout_at: 0,
      arbitrator: undefined,
    } as never);
    render(<BuyerPanel />);

    fireEvent.change(screen.getByLabelText(/escrow id/i), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: /look up escrow/i }));

    await waitFor(() =>
      expect(screen.getByText(/fund escrow/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/created/i)).toBeInTheDocument();
  });
});
