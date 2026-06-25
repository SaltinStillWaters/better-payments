import { describe, expect, it } from "vitest";
import { stroopsToXlm, truncateAddress, xlmToStroops } from "@/lib/stellar";

describe("truncateAddress", () => {
  it("truncates a Stellar address", () => {
    const address = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHK3M";
    expect(truncateAddress(address)).toBe("GAAAAA...HK3M");
  });
});

describe("xlmToStroops", () => {
  it("converts XLM to stroops", () => {
    expect(xlmToStroops("1")).toBe(10_000_000n);
    expect(xlmToStroops("0.5")).toBe(5_000_000n);
  });

  it("throws on invalid amount", () => {
    expect(() => xlmToStroops("0")).toThrow("Invalid XLM amount");
    expect(() => xlmToStroops("abc")).toThrow("Invalid XLM amount");
    expect(() => xlmToStroops("-1")).toThrow("Invalid XLM amount");
  });
});

describe("stroopsToXlm", () => {
  it("converts stroops to XLM", () => {
    expect(stroopsToXlm(10_000_000n)).toBe("1");
    expect(stroopsToXlm("5000000")).toBe("0.5");
  });
});
