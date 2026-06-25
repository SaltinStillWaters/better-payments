import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SellerPanel } from "./SellerPanel";

const mockExecute = vi.fn();
const mockReset = vi.fn();
const mockSign = vi.fn();

let mockAddress: string | null = "GSELLER";

vi.mock("@/hooks/useStellarWallet", () => ({
  useStellarWallet: () => ({ address: mockAddress, sign: mockSign }),
}));

let mockTxState = {
  status: "idle" as string,
  hash: undefined as string | undefined,
  error: null as string | null,
};

vi.mock("@/hooks/useTransaction", () => ({
  useTransaction: () => ({
    ...mockTxState,
    execute: mockExecute,
    reset: mockReset,
  }),
}));

vi.mock("@/lib/transactions", () => ({
  buildCreateEscrowTx: vi.fn().mockResolvedValue("xdr"),
}));

vi.mock("@/lib/stellar", () => ({
  ESCROW_CONTRACT_ID: "CCONTRACT",
}));

describe("SellerPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddress = "GSELLER";
    mockTxState = { status: "idle", hash: undefined, error: null };
  });

  it("prompts to connect when no wallet", () => {
    mockAddress = null;
    render(<SellerPanel />);
    expect(
      screen.getByText(/connect your wallet to create an escrow/i)
    ).toBeInTheDocument();
  });

  it("renders the create escrow form when connected", () => {
    render(<SellerPanel />);
    expect(screen.getByLabelText(/buyer address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create escrow/i })
    ).toBeInTheDocument();
  });

  it("executes the transaction and renders a QR code on success", async () => {
    mockExecute.mockResolvedValue({ result: 7n, hash: "abc" });
    render(<SellerPanel />);

    fireEvent.change(screen.getByLabelText(/buyer address/i), {
      target: { value: "GBUYER" },
    });
    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create escrow/i }));

    await waitFor(() => expect(mockExecute).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText(/escrow #7/i)).toBeInTheDocument()
    );
  });

  it("disables the submit button while busy", () => {
    mockTxState = { status: "submitting", hash: undefined, error: null };
    render(<SellerPanel />);
    expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();
  });
});
