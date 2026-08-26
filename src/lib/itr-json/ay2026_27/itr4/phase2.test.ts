import { describe, expect, it } from "vitest";
import { fixtures } from "@/lib/tax/fixtures";
import { TaxEngine } from "@/lib/tax/engine";
import { generateITRJson } from "@/lib/itr-json/mapper";
import { validateITR4Json } from "@/lib/itr-json/validator/officialValidator";
import { determineItrType } from "@/lib/tax-rules/ay2026_27/eligibility";
import { businessValidate } from "@/lib/validation/businessRules";
import { evaluateDeductions } from "@/lib/tax-engine/ay2026_27/deductions";

const frozen = new Date("2026-08-26T00:00:00.000Z");

function elig(data: typeof fixtures.simpleBusiness, extras: Partial<Parameters<typeof determineItrType>[0]> = {}) {
  const c = TaxEngine.calculate(data);
  return determineItrType({
    taxpayerType: data.taxpayerType,
    residentialStatus: data.residentialStatus,
    isLlp: false,
    isDirector: false,
    sources: ["BUSINESS"],
    totalIncome: c.grossTotalIncomeIncLtcg,
    housePropertyCount: data.houseProperties.length,
    ltcg112A: c.capitalGains,
    stcg: 0,
    otherLtcg: 0,
    agriculturalIncome: 0,
    lotteryOrRacehorse: false,
    foreignAssets: false,
    unlistedShares: false,
    businessTurnover: data.business.turnover,
    businessCash: data.business.cashReceipts,
    professionReceipts: data.profession.grossReceipts,
    professionCash: data.profession.cashReceipts,
    usesPresumptive: true,
    detailedBooks: false,
    fnoTrading: false,
    ...extras,
  });
}

describe("phase2 ITR-4 fixtures", () => {
  it("1 simple eligible ITR-4", () => {
    const data = fixtures.simpleBusiness;
    const c = TaxEngine.calculate(data);
    expect(elig(data).itr4Eligible).toBe(true);
    expect(c.businessIncome).toBe(270_000);
    expect(c.totalTax).toBe(0);
    const g = generateITRJson(data, { generatedAt: frozen });
    expect(g.official.schemaMode).toBe("OfficialSchema");
    expect(g.official.valid).toBe(true);
    expect((g.json as { ITR: { ITR4: unknown } }).ITR.ITR4).toBeTruthy();
  });

  it("2 salary + presumptive business", () => {
    const c = TaxEngine.calculate(fixtures.salaryPlusBusiness);
    expect(c.salaryIncome).toBe(840_000 - 75_000);
    expect(c.businessIncome).toBe(72_000);
    expect(c.specialRateIncome).toBe(0);
    const g = generateITRJson(fixtures.salaryPlusBusiness, { generatedAt: frozen });
    expect(g.official.valid).toBe(true);
  });

  it("3 professional 44ADA", () => {
    const c = TaxEngine.calculate(fixtures.professional);
    expect(c.professionIncome).toBe(1_400_000);
    expect(generateITRJson(fixtures.professional, { generatedAt: frozen }).official.valid).toBe(true);
  });

  it("4 business + bank interest", () => {
    const c = TaxEngine.calculate(fixtures.businessInterest);
    expect(c.otherSources).toBe(32_000);
    expect(generateITRJson(fixtures.businessInterest, { generatedAt: frozen }).official.valid).toBe(true);
  });

  it("5 TDS + tax payable", () => {
    const c = TaxEngine.calculate(fixtures.withTds);
    expect(c.tds).toBe(84_000);
    expect(c.prepaid).toBe(84_000);
    expect(generateITRJson(fixtures.withTds, { generatedAt: frozen }).official.valid).toBe(true);
  });

  it("6 TDS + refund", () => {
    const data = {
      ...fixtures.simpleBusiness,
      salary: { gross: 500_000, exemptions: 0, tds: 40_000, employerName: "Acme", employerTan: "DELA12345A" },
    };
    const c = TaxEngine.calculate(data);
    expect(c.refundOrPayable).toBeGreaterThan(0);
    expect(generateITRJson(data, { generatedAt: frozen }).official.valid).toBe(true);
  });

  it("7 capital gains special rate not slab", () => {
    const data = {
      ...fixtures.simpleBusiness,
      capitalGains: [{ kind: "LTCG_112A", section: "112A", amount: 200_000, saleConsideration: 500_000, acquisitionCost: 300_000 }],
    };
    const c = TaxEngine.calculate(data);
    expect(c.specialRateIncome).toBe(200_000);
    expect(c.taxOnSpecialRate).toBeGreaterThan(0);
    expect(c.normalRateIncome).toBe(c.businessIncome);
    expect(c.grossTotalIncome).toBe(c.businessIncome);
  });

  it("8 house property + other income", () => {
    const data = {
      ...fixtures.simpleBusiness,
      houseProperties: [{ occupancy: "LET_OUT" as const, annualLetableValue: 240_000, municipalTaxes: 12_000, interestOnLoan: 50_000 }],
      otherIncome: [{ kind: "Interest", amount: 18_000, source: "SBI" }],
    };
    const c = TaxEngine.calculate(data);
    expect(c.housePropertyIncome).not.toBe(0);
    expect(c.otherSources).toBe(18_000);
    expect(generateITRJson(data, { generatedAt: frozen }).official.valid).toBe(true);
  });

  it("9 invalid ITR-4 eligibility", () => {
    const r = elig(fixtures.ineligibleItr4, { stcg: 200_000, sources: ["BUSINESS"], fnoTrading: true });
    expect(r.itr4Eligible).toBe(false);
  });

  it("10 missing required information", () => {
    const issues = businessValidate(fixtures.mismatch);
    expect(issues.some((i) => i.field === "pan")).toBe(true);
    expect(issues.some((i) => i.field === "bankAccounts")).toBe(true);
    expect(generateITRJson(fixtures.mismatch, { generatedAt: frozen }).valid).toBe(false);
  });

  it("11 validation mismatch declared 44AD too low", () => {
    const data = { ...fixtures.simpleBusiness, business: { ...fixtures.simpleBusiness.business, declaredIncome: 1 } };
    expect(businessValidate(data).some((i) => i.id === "ITR4_BP_004")).toBe(true);
  });

  it("12 official schema failure extra property", () => {
    const g = generateITRJson(fixtures.simpleBusiness, { generatedAt: frozen });
    const json = JSON.parse(JSON.stringify(g.json)) as { ITR: { ITR4: Record<string, unknown> } };
    json.ITR.ITR4.NotARealField = true;
    const v = validateITR4Json(json, "2026-27");
    expect(v.valid).toBe(false);
    expect(v.schemaMode).toBe("OfficialSchema");
  });
});

describe("invariants", () => {
  it("taxable income does not exceed GTI + CG except documented specials", () => {
    const c = TaxEngine.calculate(fixtures.salaryPlusBusiness);
    expect(c.taxableIncome).toBeLessThanOrEqual(c.grossTotalIncomeIncLtcg);
  });
  it("tax liability is never negative", () => {
    expect(TaxEngine.calculate(fixtures.simpleBusiness).totalTax).toBeGreaterThanOrEqual(0);
  });
  it("deduction cannot exceed amount entered", () => {
    const rows = evaluateDeductions([{ section: "80C", amount: 200_000 }], "OLD");
    expect(rows[0].eligibleAmount).toBeLessThanOrEqual(150_000);
  });
  it("new regime disallows 80C", () => {
    const rows = evaluateDeductions([{ section: "80C", amount: 100_000 }], "NEW");
    expect(rows[0].eligibleAmount).toBe(0);
  });
});
