import { describe, expect, it } from "vitest";
import { roundIncomeAmount, roundReturnAmount, roundTaxAmount } from "./rounding";

describe("rounding", () => {
  it("rounds decimals", () => {
    expect(roundIncomeAmount(10.4)).toBe(10);
    expect(roundIncomeAmount(10.5)).toBe(11);
    expect(roundTaxAmount(1.2)).toBe(1);
  });
  it("handles large values", () => {
    expect(roundIncomeAmount(99_999_999.4)).toBe(99_999_999);
  });
  it("zero", () => {
    expect(roundTaxAmount(0)).toBe(0);
    expect(roundReturnAmount(0)).toBe(0);
  });
  it("negative tax clamps to 0", () => {
    expect(roundTaxAmount(-12)).toBe(0);
  });
  it("invalid becomes 0", () => {
    expect(roundIncomeAmount(Number.NaN)).toBe(0);
    expect(roundTaxAmount(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
