import { describe, expect, it } from "vitest";
import { commaizeAmount, decommaizeAmount, krwReadingHint } from "./format";

describe("commaizeAmount / decommaizeAmount", () => {
  it("formats digits with thousands separators", () => {
    expect(commaizeAmount("12000")).toBe("12,000");
    expect(commaizeAmount("")).toBe("");
  });

  it("round-trips through decommaizeAmount", () => {
    expect(decommaizeAmount(commaizeAmount("1234567"))).toBe("1234567");
  });
});

describe("krwReadingHint", () => {
  it("matches the spec's worked example (§5 F1 AC)", () => {
    expect(krwReadingHint(12_000)).toBe("1만 2천원");
  });

  it("returns empty for zero/negative amounts", () => {
    expect(krwReadingHint(0)).toBe("");
    expect(krwReadingHint(-5)).toBe("");
  });

  it("handles 억 and keeps sub-천 remainders instead of dropping them", () => {
    expect(krwReadingHint(150_000_000)).toBe("1억 5000만원");
    expect(krwReadingHint(1_234)).toBe("1천 234원");
    expect(krwReadingHint(500)).toBe("500원"); // below 1,000 -> raw amount, no 천 unit
  });

  it("does not understate the spec's own demo amount (§12 demo script)", () => {
    expect(krwReadingHint(4_500)).toBe("4천 500원");
  });
});
