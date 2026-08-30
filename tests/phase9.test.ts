import { describe, expect, it } from "vitest";
import { TaxEngine } from "@/lib/tax/engine";
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

describe("Phase 9.1 independent ITR-4 tax constants", () => {
  it("case 1 — new regime salary ₹15,00,000", () => {
    const c = TaxEngine.calculate(
      taxpayer({ salary: { gross: 1_500_000, employerName: "Acme", employerTan: "DELA12345A" } }),
      FILED_ON,
    );
    expect(c.taxableIncome).toBe(1_425_000);
    expect(c.taxBeforeRebate).toBe(93_750);
    expect(c.rebate).toBe(0);
    expect(c.cess).toBe(3_750);
    expect(c.totalTax).toBe(97_500);
  });

  it("case 2 — new regime salary ₹10,00,000 + interest ₹50,000", () => {
    const c = TaxEngine.calculate(
      taxpayer({
        salary: { gross: 1_000_000, employerName: "Acme", employerTan: "DELA12345A" },
        otherIncome: [{ kind: "Interest", amount: 50_000, source: "Bank" }],
      }),
      FILED_ON,
    );
    expect(c.taxableIncome).toBe(975_000);
    expect(c.totalTax).toBe(0);
    expect(c.cess).toBe(0);
    expect(c.totalLiability).toBe(0);
  });

  it("case 3 — 87A rebate at ₹12,00,000 taxable", () => {
    const c = TaxEngine.calculate(
      taxpayer({ salary: { gross: 1_275_000, employerName: "Acme", employerTan: "DELA12345A" } }),
      FILED_ON,
    );
    expect(c.taxableIncome).toBe(1_200_000);
    expect(c.rebate).toBe(60_000);
    expect(c.totalTax).toBe(0);
    expect(c.cess).toBe(0);
    expect(c.totalLiability).toBe(0);
  });

  it("case 4 — 44AD 6% of ₹40,00,000 digital turnover", () => {
    const c = TaxEngine.calculate(
      taxpayer({
        business: {
          section: "44AD",
          turnover: 4_000_000,
          digitalReceipts: 4_000_000,
          cashReceipts: 0,
          declaredIncome: 0,
          nature: "Trading",
          natureCode: "09027",
        },
      }),
      FILED_ON,
    );
    expect(c.businessIncome).toBe(240_000);
    expect(c.taxableIncome).toBe(240_000);
    expect(c.totalTax).toBe(0);
  });

  it("case 5 — old regime salary ₹10,00,000 with 80C ₹1,50,000", () => {
    const c = TaxEngine.calculate(
      taxpayer({
        regime: "OLD",
        salary: { gross: 1_000_000, employerName: "Acme", employerTan: "DELA12345A" },
        deductions: [{ section: "80C", amount: 150_000 }],
      }),
      FILED_ON,
    );
    expect(c.taxableIncome).toBe(800_000);
    expect(c.taxBeforeRebate).toBe(72_500);
    expect(c.cess).toBe(2_900);
    expect(c.totalTax).toBe(75_400);
  });
});
