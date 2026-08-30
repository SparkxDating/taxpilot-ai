import { describe, expect, it } from "vitest";
import { TaxEngine } from "@/lib/tax/engine";
import { STANDARD_DEDUCTION_NEW, STANDARD_DEDUCTION_OLD } from "@/lib/tax-rules/ay2026_27/deductions";
import { CESS_RATE, taxOnSlabs, NEW_REGIME_SLABS, OLD_REGIME_SLABS_GENERAL } from "@/lib/tax-rules/ay2026_27/incomeTaxRules";
import { rebate87A } from "@/lib/tax-rules/ay2026_27/rebate";
import { healthEducationCess } from "@/lib/tax-rules/ay2026_27/cess";
import { presumptive44AD, presumptive44ADA } from "@/lib/tax-rules/ay2026_27/presumptive";
import { calculateRefundOrPayable } from "@/lib/tax-engine/ay2026_27/refund";
import type { NormalizedReturn } from "@/lib/tax/model";

const FILED_ON = new Date("2026-08-26T00:00:00.000Z");

function taxpayer(
  patch: Omit<Partial<NormalizedReturn>, "salary" | "business" | "profession" | "deductions"> & {
    salary?: Partial<NormalizedReturn["salary"]>;
    business?: Partial<NormalizedReturn["business"]>;
    profession?: Partial<NormalizedReturn["profession"]>;
    deductions?: NormalizedReturn["deductions"];
  } = {},
): NormalizedReturn {
  const seed: NormalizedReturn = {
    assessmentYear: "2026-27",
    itrType: "ITR-4",
    taxpayerType: "INDIVIDUAL",
    residentialStatus: "RESIDENT",
    pan: "ABCDE1234F",
    name: "Accuracy Case",
    fatherName: "Ramesh Taxpayer",
    email: "accuracy@taxpilot.local",
    phone: "9876543210",
    dateOfBirth: "1990-01-15",
    addressLine1: "12 MG Road",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
    verificationPlace: "Bengaluru",
    regime: "NEW",
    salary: { gross: 0, exemptions: 0, tds: 0, employerName: "", employerTan: "" },
    business: { section: "44AD", turnover: 0, digitalReceipts: 0, cashReceipts: 0, declaredIncome: 0, nature: "" },
    profession: { section: "44ADA", grossReceipts: 0, cashReceipts: 0, declaredIncome: 0, profession: "" },
    houseProperties: [],
    otherIncome: [],
    capitalGains: [],
    deductions: [],
    tds: [],
    taxPayments: [],
    bankAccounts: [{ ifsc: "HDFC0001234", accountNumber: "12345678901", isPrimary: true, bankName: "HDFC Bank", accountType: "SB" }],
  };
  return {
    ...seed,
    ...patch,
    salary: { ...seed.salary, ...patch.salary },
    business: { ...seed.business, ...patch.business },
    profession: { ...seed.profession, ...patch.profession },
    deductions: patch.deductions ?? seed.deductions,
  };
}

describe("Phase 9 ITR-4 tax accuracy", () => {
  it("A — simple salary: std deduction, slabs, cess, TDS refund", () => {
    const data = taxpayer({
      salary: { gross: 1_500_000, tds: 100_000, employerName: "Acme", employerTan: "DELA12345A" },
    });
    const c = TaxEngine.calculate(data, FILED_ON);
    expect(c.standardDeduction).toBe(STANDARD_DEDUCTION_NEW);
    expect(c.salaryIncome).toBe(1_500_000 - 75_000);
    expect(c.taxableIncome).toBe(1_425_000);
    // Independent: 4L@0 + 4L@5% + 4L@10% + 2.25L@15% = 0 + 20,000 + 40,000 + 33,750
    const taxBefore = taxOnSlabs(1_425_000, NEW_REGIME_SLABS);
    expect(taxBefore).toBe(93_750);
    expect(c.taxBeforeRebate).toBe(93_750);
    expect(c.rebate).toBe(0);
    expect(c.marginalRelief).toBe(0);
    const cess = healthEducationCess(93_750);
    expect(cess).toBe(3_750);
    expect(c.cess).toBe(3_750);
    expect(CESS_RATE).toBe(0.04);
    expect(c.totalTax).toBe(97_500);
    expect(c.tds).toBe(100_000);
    expect(c.refundOrPayable).toBe(2_500);
    expect(c.isRefund).toBe(true);
  });

  it("B — salary + interest is added to total income", () => {
    const data = taxpayer({
      salary: { gross: 1_000_000, tds: 50_000, employerName: "Acme", employerTan: "DELA12345A" },
      otherIncome: [{ kind: "Interest", amount: 50_000, source: "Bank" }],
    });
    const c = TaxEngine.calculate(data, FILED_ON);
    expect(c.salaryIncome).toBe(1_000_000 - 75_000);
    expect(c.otherSources).toBe(50_000);
    expect(c.grossTotalIncome).toBe(975_000);
    expect(c.taxableIncome).toBe(975_000);
    expect(c.taxBeforeRebate).toBe(taxOnSlabs(975_000, NEW_REGIME_SLABS));
    expect(c.taxBeforeRebate).toBe(37_500);
    expect(c.rebate).toBe(37_500);
    expect(c.totalTax).toBe(0);
    expect(c.cess).toBe(0);
    expect(c.tds).toBe(50_000);
    expect(c.refundOrPayable).toBe(50_000);
  });

  it("C — 44AD presumptive income is 6% of digital turnover", () => {
    const data = taxpayer({
      business: {
        section: "44AD",
        turnover: 4_000_000,
        digitalReceipts: 4_000_000,
        cashReceipts: 0,
        declaredIncome: 0,
        nature: "Trading",
        natureCode: "09027",
      },
    });
    const p = presumptive44AD(4_000_000, 4_000_000, 0, 0);
    expect(p.income).toBe(240_000);
    const c = TaxEngine.calculate(data, FILED_ON);
    expect(c.businessIncome).toBe(240_000);
    expect(c.grossTotalIncome).toBe(240_000);
    expect(c.taxableIncome).toBe(240_000);
    expect(c.totalTax).toBe(0);
  });

  it("D — 44ADA presumptive income is 50% of receipts", () => {
    const data = taxpayer({
      profession: {
        section: "44ADA",
        grossReceipts: 3_000_000,
        cashReceipts: 0,
        declaredIncome: 0,
        profession: "Design",
        natureCode: "16005",
      },
    });
    const p = presumptive44ADA(3_000_000, 0, 0);
    expect(p.income).toBe(1_500_000);
    const c = TaxEngine.calculate(data, FILED_ON);
    expect(c.professionIncome).toBe(1_500_000);
    expect(c.taxableIncome).toBe(1_500_000);
    const taxBefore = taxOnSlabs(1_500_000, NEW_REGIME_SLABS);
    expect(taxBefore).toBe(105_000);
    expect(c.taxBeforeRebate).toBe(105_000);
    expect(c.rebate).toBe(0);
    expect(c.cess).toBe(4_200);
    expect(c.totalTax).toBe(109_200);
  });

  it("E — old-regime 80C deduction reduces taxable income", () => {
    const data = taxpayer({
      regime: "OLD",
      salary: { gross: 1_000_000, tds: 80_000, employerName: "Acme", employerTan: "DELA12345A" },
      deductions: [{ section: "80C", amount: 150_000 }],
    });
    const c = TaxEngine.calculate(data, FILED_ON);
    expect(c.standardDeduction).toBe(STANDARD_DEDUCTION_OLD);
    expect(c.salaryIncome).toBe(950_000);
    expect(c.grossTotalIncome).toBe(950_000);
    expect(c.deductions).toBe(150_000);
    expect(c.taxableIncome).toBe(800_000);
    expect(c.taxBeforeRebate).toBe(taxOnSlabs(800_000, OLD_REGIME_SLABS_GENERAL));
    expect(c.taxBeforeRebate).toBe(72_500);
    expect(c.cess).toBe(2_900);
    expect(c.totalTax).toBe(75_400);
  });

  it("F — 87A rebate at ₹12 lakh and marginal relief just above", () => {
    const atCap = TaxEngine.calculate(
      taxpayer({ salary: { gross: 1_275_000, employerName: "Acme", employerTan: "DELA12345A" } }),
      FILED_ON,
    );
    expect(atCap.taxableIncome).toBe(1_200_000);
    expect(atCap.taxBeforeRebate).toBe(60_000);
    const rebate = rebate87A({
      residentIndividual: true,
      regime: "NEW",
      taxableIncome: 1_200_000,
      taxBeforeRebate: 60_000,
    });
    expect(rebate.rebate).toBe(60_000);
    expect(atCap.rebate).toBe(60_000);
    expect(atCap.totalTax).toBe(0);
    expect(atCap.cess).toBe(0);

    const above = TaxEngine.calculate(
      taxpayer({ salary: { gross: 1_275_100, employerName: "Acme", employerTan: "DELA12345A" } }),
      FILED_ON,
    );
    expect(above.taxableIncome).toBe(1_200_100);
    expect(above.taxBeforeRebate).toBe(60_015);
    expect(above.rebate).toBe(0);
    expect(above.marginalRelief).toBe(60_015 - 100);
    expect(above.totalTax).toBe(104);
  });

  it("G — health and education cess is 4% of tax after rebate", () => {
    const data = taxpayer({
      salary: { gross: 1_500_000, tds: 100_000, employerName: "Acme", employerTan: "DELA12345A" },
    });
    const c = TaxEngine.calculate(data, FILED_ON);
    expect(c.taxBeforeRebate - c.rebate - c.marginalRelief).toBe(93_750);
    expect(c.cess).toBe(healthEducationCess(93_750));
    expect(c.cess).toBe(3_750);
    expect(c.totalTax).toBe(93_750 + 3_750);
  });

  it("H — TDS reduces payable using the engine tax, not a second calculator", () => {
    const data = taxpayer({
      salary: { gross: 1_500_000, tds: 100_000, employerName: "Acme", employerTan: "DELA12345A" },
    });
    const c = TaxEngine.calculate(data, FILED_ON);
    const settlement = calculateRefundOrPayable({
      totalTax: c.totalLiability,
      tds: c.tds,
      tcs: c.tcs,
      advanceTax: c.advanceTax,
      selfAssessmentTax: c.selfAssessmentTax,
    });
    expect(c.tds).toBe(100_000);
    expect(c.totalTax).toBe(97_500);
    expect(settlement.signed).toBe(c.refundOrPayable);
    expect(c.refundOrPayable).toBe(2_500);
  });

  it("I — legitimate zero-tax return stays zero", () => {
    const data = taxpayer({
      salary: { gross: 800_000, employerName: "Acme", employerTan: "DELA12345A" },
    });
    const c = TaxEngine.calculate(data, FILED_ON);
    expect(c.taxableIncome).toBe(725_000);
    expect(c.taxBeforeRebate).toBe(16_250);
    expect(c.rebate).toBe(16_250);
    expect(c.totalTax).toBe(0);
    expect(c.cess).toBe(0);
    expect(c.totalLiability).toBe(0);
    expect(c.refundOrPayable).toBe(0);
  });
});
