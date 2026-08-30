import { describe, expect, it } from "vitest";
import { json } from "./utils";
import { parseEligibilityResult } from "./tax-rules/ay2026_27/eligibility";

describe("json", () => {
  it("returns fallback for empty raw", () => {
    expect(json("", { a: 1 })).toEqual({ a: 1 });
    expect(json(null, [])).toEqual([]);
  });

  it("merges object fallbacks so stored {} does not drop required fields", () => {
    expect(json("{}", { recommended: "ITR-4", reasons: [] as string[] })).toEqual({
      recommended: "ITR-4",
      reasons: [],
    });
  });

  it("uses array fallback when stored JSON is a non-array object", () => {
    expect(json("{}", ["Yes", "No"])).toEqual(["Yes", "No"]);
    expect(json("null", ["Yes"])).toEqual(["Yes"]);
  });

  it("keeps valid parsed arrays and objects", () => {
    expect(json('["SALARY"]', [])).toEqual(["SALARY"]);
    expect(json('{"itr4Eligible":false,"reasons":["Director"]}', { itr4Eligible: true, reasons: [] as string[] })).toEqual({
      itr4Eligible: false,
      reasons: ["Director"],
    });
  });
});

describe("parseEligibilityResult", () => {
  it("does not throw when eligibility JSON is the schema default {}", () => {
    const eligibility = parseEligibilityResult("{}");
    expect(eligibility.itr4Eligible).toBe(true);
    expect(eligibility.reasons.map((r) => r)).toEqual([]);
    expect(eligibility.warnings.map((w) => w)).toEqual([]);
  });

  it("treats missing itr4Eligible as eligible so the interview page does not render reasons.map on undefined", () => {
    const eligibility = parseEligibilityResult("{}");
    expect(eligibility.itr4Eligible).toBe(true);
    expect(() => eligibility.reasons.map((r) => r)).not.toThrow();
  });

  it("preserves a stored ITR-3 decision", () => {
    const eligibility = parseEligibilityResult(
      JSON.stringify({ recommended: "ITR-3", itr4Eligible: false, reasons: ["A company director cannot file ITR-4."], warnings: [] }),
    );
    expect(eligibility.recommended).toBe("ITR-3");
    expect(eligibility.itr4Eligible).toBe(false);
    expect(eligibility.reasons).toEqual(["A company director cannot file ITR-4."]);
  });
});
