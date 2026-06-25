import { describe, expect, it } from "vitest";
import { parseContractError, parseHorizonError } from "@/lib/transactions";

describe("parseContractError", () => {
  it("maps known contract errors to readable messages", () => {
    expect(parseContractError(new Error("EscrowNotFound"))).toBe(
      "Escrow not found."
    );
    expect(parseContractError(new Error("InvalidAmount"))).toBe(
      "Invalid escrow amount."
    );
    expect(parseContractError(new Error("Unauthorized"))).toBe(
      "You are not authorized to perform this action."
    );
    expect(parseContractError(new Error("AlreadyFunded"))).toBe(
      "This escrow has already been funded."
    );
    expect(parseContractError(new Error("ContractPaused"))).toBe(
      "The escrow contract is currently paused."
    );
  });

  it("returns the original message for unknown errors", () => {
    expect(parseContractError(new Error("Some random error"))).toBe(
      "Some random error"
    );
  });

  it("handles non-error values", () => {
    expect(parseContractError(null)).toBe(
      "An unexpected contract error occurred."
    );
  });
});

describe("parseHorizonError", () => {
  it("maps known Horizon error codes", () => {
    expect(parseHorizonError(new Error("tx_insufficient_balance"))).toBe(
      "Insufficient XLM balance for this transaction."
    );
    expect(parseHorizonError(new Error("tx_bad_auth"))).toBe(
      "Transaction authorization failed. Check your network and try again."
    );
    expect(parseHorizonError(new Error("tx_bad_seq"))).toBe(
      "Sequence number mismatch. Please refresh and try again."
    );
  });

  it("returns the original message for unknown errors", () => {
    expect(parseHorizonError(new Error("custom horizon error"))).toBe(
      "custom horizon error"
    );
  });
});
