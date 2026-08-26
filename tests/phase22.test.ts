import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { fixtures } from "@/lib/tax/fixtures";
import { TaxEngine } from "@/lib/tax/engine";
import { generateITRJson } from "@/lib/itr-json/mapper";
import { compareSchemaChecksum, verifySchemaFile, verifySchemaIntegrity } from "@/lib/itr-json/schemaIntegrity";
import { evaluate80D } from "@/lib/tax-engine/ay2026_27/deduction80d";
import { evaluateDeductions } from "@/lib/tax-engine/ay2026_27/deductions";
import { ageAtFinancialYearEnd, ageCategoryFromDob } from "@/lib/tax-engine/ay2026_27/age";
import { getApplicableDeductions, calculateTaxByRegime, slabsFor } from "@/lib/tax-engine/ay2026_27/regime";
import { interest234A } from "@/lib/tax-engine/ay2026_27/interest/234A";
import { interest234B } from "@/lib/tax-engine/ay2026_27/interest/234B";
import { interest234C } from "@/lib/tax-engine/ay2026_27/interest/234C";
import { fee234F } from "@/lib/tax-engine/ay2026_27/interest/234F";
import { computeCapitalGains, isListedEquityLongTerm } from "@/lib/tax-engine/ay2026_27/capitalGains";
import { calculateRefundOrPayable } from "@/lib/tax-engine/ay2026_27/refund";
import { auditITR4Mapping } from "@/lib/itr-json/ay2026_27/itr4/auditMapping";
import { detectUnsupported } from "@/lib/itr-rules/ay2026_27/unsupported";
import { nextJsonFileStatuses } from "@/lib/json/lifecycle";
import metadata from "@/lib/itr-json/schemas/ay2026_27/itr4/metadata.json";
import type { NormalizedReturn } from "@/lib/tax/model";

const frozen = new Date("2026-08-26T00:00:00.000Z");
const due = new Date(Date.UTC(2026, 7, 31));
const late = new Date(Date.UTC(2026, 9, 15));

describe("schema integrity", () => {
  it("PASS: bundled schema matches metadata and was verified against ITD", () => {
    const r = verifySchemaIntegrity();
    expect(r.ok).toBe(true);
    expect(r.actual).toBe(String(metadata.sha256).toLowerCase());
    expect(metadata.verifiedMatch).toBe(true);
  });

  it("FAIL: incorrect metadata checksum", () => {
    const r = compareSchemaChecksum("0".repeat(64), verifySchemaIntegrity().actual);
    expect(r.ok).toBe(false);
    expect(r.message).toContain("JSON generation is disabled");
  });

  it("FAIL: modified schema bytes", () => {
    const dir = mkdtempSync(join(tmpdir(), "itr4-schema-"));
    const file = join(dir, "schema.json");
    writeFileSync(file, '{"not":"official"}');
    const r = verifySchemaFile(file, String(metadata.sha256));
    expect(r.ok).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("FAIL: missing schema", () => {
    const r = verifySchemaFile(join(tmpdir(), "no-such-itr4-schema.json"), String(metadata.sha256));
    expect(r.ok).toBe(false);
    expect(r.missing).toBe(true);
    expect(r.message).toBe("Official AY 2026–27 ITR-4 schema integrity verification failed. JSON generation is disabled.");
  });
});

describe("234A / 234B / 234C / 234F", () => {
  it("234A is zero on or before due date and positive when late with unpaid tax", () => {
    const onTime = interest234A({
      filingDate: due,
      dueDate: due,
      tax: 50_000,
      tds: 0,
      tcs: 0,
      advanceTax: 0,
      selfAssessmentTax: 0,
    });
    expect(onTime.amount).toBe(0);
    const lateFee = interest234A({
      filingDate: late,
      dueDate: due,
      tax: 50_000,
      tds: 0,
      tcs: 0,
      advanceTax: 0,
      selfAssessmentTax: 0,
    });
    expect(lateFee.amount).toBeGreaterThan(0);
  });

  it("234B applies only when advance tax is under 90% and assessed tax ≥ ₹10,000", () => {
    const none = interest234B({
      filingDate: frozen,
      ayStart: new Date(Date.UTC(2026, 3, 1)),
      tax: 5_000,
      tds: 0,
      tcs: 0,
      advanceTax: 0,
    });
    expect(none.applicable).toBe(false);
    const dueAmt = interest234B({
      filingDate: frozen,
      ayStart: new Date(Date.UTC(2026, 3, 1)),
      tax: 100_000,
      tds: 0,
      tcs: 0,
      advanceTax: 0,
    });
    expect(dueAmt.applicable).toBe(true);
    expect(dueAmt.amount).toBeGreaterThan(0);
  });

  it("234C is zero when no advance-tax liability, computed when unpaid, blocked when undated payments exist", () => {
    expect(interest234C({ tax: 5_000, tds: 0, tcs: 0, payments: [] }).amount).toBe(0);
    const unpaid = interest234C({ tax: 100_000, tds: 0, tcs: 0, payments: [] });
    expect(unpaid.unsupported).toBe(false);
    expect(unpaid.amount).toBeGreaterThan(0);
    const undated = interest234C({ tax: 100_000, tds: 0, tcs: 0, payments: [{ amount: 20_000 }] });
    expect(undated.unsupported).toBe(true);
    const data: NormalizedReturn = {
      ...fixtures.professional,
      taxPayments: [{ kind: "ADVANCE", amount: 20_000 }],
    };
    expect(detectUnsupported(data).some((x) => x.code === "UNSUPPORTED_INTEREST_CALCULATION" && x.blocksJson)).toBe(true);
    expect(generateITRJson(data, { generatedAt: frozen }).json).toBeNull();
  });

  it("234F is 0 / 1000 / 5000 at the statutory boundaries", () => {
    expect(fee234F({ filingDate: due, dueDate: due, taxableIncome: 600_000 }).amount).toBe(0);
    expect(fee234F({ filingDate: late, dueDate: due, taxableIncome: 500_000 }).amount).toBe(1_000);
    expect(fee234F({ filingDate: late, dueDate: due, taxableIncome: 500_001 }).amount).toBe(5_000);
  });
});

describe("80D baskets", () => {
  it("normal taxpayer self premium below / at / above ₹25,000", () => {
    const below = evaluate80D({
      selfSenior: false,
      parentsSenior: false,
      selfPremium: 20_000,
      selfPreventive: 0,
      selfMedical: 0,
      parentsPremium: 0,
      parentsPreventive: 0,
      parentsMedical: 0,
    });
    expect(below.eligibleAmount).toBe(20_000);
    const at = evaluate80D({
      selfSenior: false,
      parentsSenior: false,
      selfPremium: 25_000,
      selfPreventive: 0,
      selfMedical: 0,
      parentsPremium: 0,
      parentsPreventive: 0,
      parentsMedical: 0,
    });
    expect(at.self.eligible).toBe(25_000);
    const over = evaluate80D({
      selfSenior: false,
      parentsSenior: false,
      selfPremium: 40_000,
      selfPreventive: 0,
      selfMedical: 0,
      parentsPremium: 0,
      parentsPreventive: 0,
      parentsMedical: 0,
    });
    expect(over.eligibleAmount).toBe(25_000);
    expect(over.disallowedAmount).toBe(15_000);
  });

  it("senior self limit ₹50,000 and parents senior stack", () => {
    const both = evaluate80D({
      selfSenior: true,
      parentsSenior: true,
      selfPremium: 50_000,
      selfPreventive: 0,
      selfMedical: 0,
      parentsPremium: 50_000,
      parentsPreventive: 0,
      parentsMedical: 0,
    });
    expect(both.eligibleAmount).toBe(100_000);
  });

  it("invalid medical claim without senior / with insurance is disallowed", () => {
    const invalid = evaluate80D({
      selfSenior: false,
      parentsSenior: false,
      selfPremium: 10_000,
      selfPreventive: 0,
      selfMedical: 20_000,
      parentsPremium: 0,
      parentsPreventive: 0,
      parentsMedical: 0,
    });
    expect(invalid.self.eligible).toBe(10_000);
    expect(invalid.self.disallowed).toBe(20_000);
  });
});

describe("80C / 80CCC / 80CCD(1) combined ceiling", () => {
  it("below, exactly at, and above ₹1.5 lakh in aggregate", () => {
    const below = evaluateDeductions(
      [
        { section: "80C", amount: 80_000 },
        { section: "80CCD(1)", amount: 40_000 },
      ],
      "OLD",
    );
    expect(below.reduce((s, r) => s + r.eligibleAmount, 0)).toBe(120_000);
    const exact = evaluateDeductions(
      [
        { section: "80C", amount: 100_000 },
        { section: "80CCC", amount: 50_000 },
      ],
      "OLD",
    );
    expect(exact.reduce((s, r) => s + r.eligibleAmount, 0)).toBe(150_000);
    const over = evaluateDeductions(
      [
        { section: "80C", amount: 150_000 },
        { section: "80CCC", amount: 50_000 },
        { section: "80CCD(1)", amount: 50_000 },
      ],
      "OLD",
    );
    expect(over.reduce((s, r) => s + r.eligibleAmount, 0)).toBe(150_000);
  });
});

describe("senior citizen from DOB", () => {
  it("boundaries on 31 Mar 2026", () => {
    expect(ageAtFinancialYearEnd("1966-04-01")).toBe(59);
    expect(ageCategoryFromDob("1966-04-01")).toBe("NORMAL");
    expect(ageAtFinancialYearEnd("1966-03-31")).toBe(60);
    expect(ageCategoryFromDob("1966-03-31")).toBe("SENIOR_CITIZEN");
    expect(ageCategoryFromDob("1946-03-31")).toBe("SUPER_SENIOR_CITIZEN");
    expect(ageCategoryFromDob("1946-04-01")).toBe("SENIOR_CITIZEN");
  });
});

describe("regime consistency", () => {
  it("new regime does not list 80C; old regime does", () => {
    expect(getApplicableDeductions("NEW")).not.toContain("80C");
    expect(getApplicableDeductions("OLD")).toContain("80C");
    expect(getApplicableDeductions("NEW")).toContain("80CCD(2)");
  });

  it("changing regime changes tax for the same income", () => {
    const income = 1_000_000;
    const neu = calculateTaxByRegime({
      regime: "NEW",
      ageCategory: "NORMAL",
      residentIndividual: true,
      normalTaxable: income,
      specialTax: 0,
    });
    const old = calculateTaxByRegime({
      regime: "OLD",
      ageCategory: "NORMAL",
      residentIndividual: true,
      normalTaxable: income,
      specialTax: 0,
    });
    expect(neu.taxOnNormal).not.toBe(old.taxOnNormal);
    expect(slabsFor("OLD", "SENIOR_CITIZEN")[0].upTo).toBe(300_000);
  });
});

describe("capital gains safety", () => {
  it("112A without dates is not converted to slab income and blocks JSON", () => {
    const r = computeCapitalGains([{ kind: "LTCG_112A", section: "112A", amount: 100_000, saleConsideration: 400_000, acquisitionCost: 300_000 }]);
    expect(r.needsManualReview).toBe(true);
    expect(r.ltcg112A).toBe(100_000);
    const data: NormalizedReturn = {
      ...fixtures.simpleBusiness,
      capitalGains: [{ kind: "LTCG_112A", section: "112A", amount: 100_000, saleConsideration: 400_000, acquisitionCost: 300_000 }],
    };
    const c = TaxEngine.calculate(data, frozen);
    expect(c.normalRateIncome).toBe(c.businessIncome);
    expect(generateITRJson(data, { generatedAt: frozen }).json).toBeNull();
  });

  it("listed equity holding period", () => {
    expect(isListedEquityLongTerm("2024-01-01", "2025-01-02")).toBe(true);
    expect(isListedEquityLongTerm("2024-01-01", "2025-01-01")).toBe(false);
  });

  it("STCG is unsupported", () => {
    const r = computeCapitalGains([{ kind: "STCG", section: "111A", amount: 50_000 }]);
    expect(r.needsManualReview).toBe(true);
    expect(r.ltcg112A).toBe(0);
  });
});

describe("refund / mapping / json version", () => {
  it("combined payments never produce negative payable", () => {
    const r = calculateRefundOrPayable({
      totalTax: 40_000,
      tds: 10_000,
      tcs: 5_000,
      advanceTax: 15_000,
      selfAssessmentTax: 20_000,
    });
    expect(r.status).toBe("REFUND");
    expect(r.amount).toBe(10_000);
  });

  it("mapping audit has no critical errors", () => {
    expect(auditITR4Mapping().status).toBe("PASS");
  });

  it("hash change supersedes prior JSON", () => {
    const a = generateITRJson(fixtures.simpleBusiness, { generatedAt: frozen });
    const b = generateITRJson({ ...fixtures.simpleBusiness, city: "Mysuru" }, { generatedAt: frozen });
    expect(nextJsonFileStatuses(a.digest, b.digest).previous).toBe("SUPERSEDED");
  });
});
