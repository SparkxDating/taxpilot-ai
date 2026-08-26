import { describe, expect, it } from "vitest";
import { TaxEngine } from "./engine";
import { fixtures } from "./fixtures";
import { determineItrType } from "@/lib/tax-rules/ay2026_27/eligibility";
import { fieldValidation, taxConsistencyValidation, validateAgainstOfficialSchema } from "./validation";
import { generateITRJson } from "@/lib/itr-json/mapper";
import { presumptive44AD, presumptive44ADA } from "@/lib/tax-rules/ay2026_27/presumptive";

describe("tax engine AY 2026-27", () => {
  it("simple 44AD business is tax-free after 87A", () => {
    const c = TaxEngine.calculate(fixtures.simpleBusiness);
    expect(c.businessIncome).toBe(270_000);
    expect(c.taxableIncome).toBe(270_000);
    expect(c.totalTax).toBe(0);
  });

  it("44ADA professional at 50%", () => {
    const c = TaxEngine.calculate(fixtures.professional);
    expect(c.professionIncome).toBe(1_400_000);
  });

  it("salary plus presumptive applies standard deduction", () => {
    const c = TaxEngine.calculate(fixtures.salaryPlusBusiness);
    expect(c.salaryIncome).toBe(840_000 - 75_000);
    expect(c.businessIncome).toBe(72_000);
  });

  it("business + interest includes other sources", () => {
    const c = TaxEngine.calculate(fixtures.businessInterest);
    expect(c.otherSources).toBe(32_000);
  });

  it("ITR-3 books uses declared income", () => {
    const c = TaxEngine.calculate(fixtures.itr3Books);
    expect(c.businessIncome).toBe(1_200_000);
  });

  it("TDS reduces payable", () => {
    const c = TaxEngine.calculate(fixtures.withTds);
    expect(c.tds).toBe(84_000);
    expect(c.prepaid).toBe(84_000);
  });
});

describe("eligibility", () => {
  it("flags STCG as ITR-3", () => {
    const r = determineItrType({
      taxpayerType: "INDIVIDUAL",
      residentialStatus: "RESIDENT",
      isLlp: false,
      isDirector: false,
      sources: ["BUSINESS", "FNO"],
      totalIncome: 400_000,
      housePropertyCount: 0,
      ltcg112A: 0,
      stcg: 200_000,
      otherLtcg: 0,
      agriculturalIncome: 0,
      lotteryOrRacehorse: false,
      foreignAssets: false,
      unlistedShares: false,
      businessTurnover: 1_000_000,
      businessCash: 0,
      professionReceipts: 0,
      professionCash: 0,
      usesPresumptive: true,
      detailedBooks: false,
      fnoTrading: true,
    });
    expect(r.itr4Eligible).toBe(false);
    expect(r.recommended).toBe("ITR-3");
  });
});

describe("presumptive", () => {
  it("uses 6% digital + 8% cash", () => {
    const p = presumptive44AD(2_000_000, 1_900_000, 100_000, 0);
    expect(p.minimum).toBe(Math.round(1_900_000 * 0.06 + 100_000 * 0.08));
    expect(p.withinLimit).toBe(true);
  });
  it("44ADA 50%", () => {
    expect(presumptive44ADA(1_000_000, 0, 0).income).toBe(500_000);
  });
});

describe("validation and JSON", () => {
  it("mismatch fixture fails field validation", () => {
    const issues = fieldValidation(fixtures.mismatch);
    expect(issues.some((i) => i.field === "pan")).toBe(true);
    expect(issues.some((i) => i.field === "bankAccounts")).toBe(true);
  });

  it("maps ITR-4 JSON and adapter schema", () => {
    const out = generateITRJson(fixtures.simpleBusiness);
    expect(out.json.ITR).toHaveProperty("ITR4");
    const schema = validateAgainstOfficialSchema(out.json, "2026-27", "ITR-4");
    expect(schema.valid).toBe(true);
  });

  it("tax consistency catches low 44AD declaration", () => {
    const issues = taxConsistencyValidation({
      ...fixtures.simpleBusiness,
      business: { ...fixtures.simpleBusiness.business, declaredIncome: 1 },
    });
    expect(issues.some((i) => i.field === "declaredIncome")).toBe(true);
  });
});
