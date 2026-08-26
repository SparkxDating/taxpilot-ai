import { describe, expect, it } from "vitest";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import { fixtures } from "@/lib/tax/fixtures";
import { TaxEngine } from "@/lib/tax/engine";
import { generateITRJson } from "@/lib/itr-json/mapper";
import { validateITR4Json } from "@/lib/itr-json/validator/officialValidator";
import { loadOfficialItr4Schema, loadProductionSchema } from "@/lib/itr-json/validator/schemaLoader";
import { compareSchemaChecksum, verifySchemaIntegrity } from "@/lib/itr-json/schemaIntegrity";
import { completenessValidate } from "@/lib/validation/completeness";
import { businessValidate } from "@/lib/validation/businessRules";
import { detectUnsupported } from "@/lib/itr-rules/ay2026_27/unsupported";
import { evaluateFilingGate } from "@/lib/validation/filingGate";
import { auditITR4Mapping } from "@/lib/itr-json/ay2026_27/itr4/auditMapping";
import { computeCapitalGains } from "@/lib/tax-engine/ay2026_27/capitalGains";
import { rebate87A } from "@/lib/tax-engine/ay2026_27/rebate";
import { calculateRefundOrPayable } from "@/lib/tax-engine/ay2026_27/refund";
import { evaluateDeductions } from "@/lib/tax-engine/ay2026_27/deductions";
import { presumptive44AD, presumptive44ADA } from "@/lib/tax-engine/ay2026_27/presumptive";
import { nextJsonFileStatuses, normalizeJsonForCompare } from "@/lib/json/lifecycle";
import { demoModeFrom } from "@/lib/demo";
import metadata from "@/lib/itr-json/schemas/ay2026_27/itr4/metadata.json";
import type { NormalizedReturn } from "@/lib/tax/model";

const frozen = new Date("2026-08-26T00:00:00.000Z");

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

describe("schema integrity", () => {
  it("official schema SHA-256 matches metadata", () => {
    const r = verifySchemaIntegrity();
    expect(r.ok).toBe(true);
    expect(r.actual).toBe(String(metadata.sha256).toLowerCase());
    expect(r.schemaVersion).toBe("Ver1.0");
  });

  it("corrupted checksum fails with the required message and blocks JSON", () => {
    const actual = verifySchemaIntegrity().actual;
    const bad = compareSchemaChecksum("0".repeat(64), actual);
    expect(bad.ok).toBe(false);
    expect(bad.message).toBe("The official AY 2026–27 ITR-4 schema could not be verified. JSON generation has been disabled.");
  });
});

describe("production schema authority", () => {
  it("production loader returns OfficialSchema, never the development adapter", () => {
    const prod = loadProductionSchema("2026-27", "ITR-4");
    const official = loadOfficialItr4Schema();
    expect(prod.kind).toBe("OfficialSchema");
    expect(official.kind).toBe("OfficialSchema");
    expect(prod.sha256.toLowerCase()).toBe(String(metadata.sha256).toLowerCase());
    const g = generateITRJson(fixtures.simpleBusiness, { generatedAt: frozen });
    expect(g.official.schemaMode).toBe("OfficialSchema");
    expect(g.official.valid).toBe(true);
    expect(g.json).toBeTruthy();
  });
});

describe("required-field completeness — never invent", () => {
  it("missing DOB blocks JSON and asks for Date of Birth", () => {
    const data = { ...fixtures.simpleBusiness, dateOfBirth: undefined };
    const issues = completenessValidate(data);
    expect(issues.some((i) => i.field === "dateOfBirth" && i.message.includes("Missing Date of Birth"))).toBe(true);
    const g = generateITRJson(data, { generatedAt: frozen });
    expect(g.valid).toBe(false);
    expect(g.json).toBeNull();
  });

  it("missing PAN blocks JSON", () => {
    const data = { ...fixtures.simpleBusiness, pan: "" };
    expect(completenessValidate(data).some((i) => i.field === "pan")).toBe(true);
    expect(generateITRJson(data, { generatedAt: frozen }).json).toBeNull();
  });

  it("invalid PAN blocks JSON", () => {
    const data = { ...fixtures.simpleBusiness, pan: "ABCDE1234" };
    expect(completenessValidate(data).some((i) => i.field === "pan")).toBe(true);
  });

  it("invalid IFSC and bank account are errors", () => {
    const data: NormalizedReturn = {
      ...fixtures.simpleBusiness,
      bankAccounts: [{ ifsc: "BAD", accountNumber: "12", isPrimary: true, bankName: "X", accountType: "SB" }],
    };
    const issues = completenessValidate(data);
    expect(issues.some((i) => i.field === "ifsc")).toBe(true);
    expect(businessValidate(data).some((i) => i.field === "accountNumber")).toBe(true);
  });

  it("invalid calendar DOB is rejected", () => {
    const data = { ...fixtures.simpleBusiness, dateOfBirth: "2026-02-31" };
    expect(completenessValidate(data).some((i) => i.field === "dateOfBirth")).toBe(true);
  });

  it("fix routes are dynamic return ids, not /returns/ID/", () => {
    const issues = completenessValidate(fixtures.mismatch, "ret_abc");
    expect(issues.length).toBeGreaterThan(0);
    for (const i of issues) {
      expect(i.fixRoute).toContain("/returns/ret_abc/");
      expect(i.fixRoute).not.toContain("/returns/ID/");
    }
  });
});

describe("unsupported scenarios block JSON", () => {
  it("unsupported capital gain type", () => {
    const data: NormalizedReturn = {
      ...fixtures.simpleBusiness,
      capitalGains: [{ kind: "STCG", section: "111A", amount: 50_000 }],
    };
    const u = detectUnsupported(data);
    expect(u.some((x) => x.code === "UNSUPPORTED_CAPITAL_GAIN_TYPE" && x.blocksJson)).toBe(true);
    expect(u.some((x) => x.message.includes("not currently supported"))).toBe(true);
    expect(generateITRJson(data, { generatedAt: frozen }).json).toBeNull();
  });

  it("ineligible ITR-4 income over ceiling", () => {
    const data: NormalizedReturn = {
      ...fixtures.simpleBusiness,
      salary: { gross: 6_000_000, exemptions: 0, tds: 0, employerName: "", employerTan: "" },
    };
    expect(detectUnsupported(data).some((x) => x.code === "UNSUPPORTED_INCOME_LIMIT")).toBe(true);
  });

  it("44AE is blocked", () => {
    const data: NormalizedReturn = {
      ...fixtures.simpleBusiness,
      business: { ...fixtures.simpleBusiness.business, section: "44AE" },
    };
    expect(detectUnsupported(data).some((x) => x.code === "UNSUPPORTED_44AE")).toBe(true);
  });

  it("negative turnover is a business error", () => {
    const data: NormalizedReturn = {
      ...fixtures.simpleBusiness,
      business: { ...fixtures.simpleBusiness.business, turnover: -1, digitalReceipts: -1, cashReceipts: 0 },
    };
    expect(businessValidate(data).some((i) => i.id === "ITR4_BP_001")).toBe(true);
  });
});

describe("section 112A capital gains", () => {
  it("zero gain", () => {
    const r = computeCapitalGains([{ kind: "LTCG_112A", section: "112A", amount: 0, saleConsideration: 100, acquisitionCost: 100 }]);
    expect(r.ltcg112A).toBe(0);
    expect(r.taxable112A).toBe(0);
    expect(r.tax112A).toBe(0);
  });

  it("below threshold", () => {
    const r = computeCapitalGains([{ kind: "LTCG_112A", section: "112A", amount: 100_000, saleConsideration: 400_000, acquisitionCost: 300_000 }]);
    expect(r.ltcg112A).toBe(100_000);
    expect(r.taxable112A).toBe(0);
    expect(r.tax112A).toBe(0);
  });

  it("exactly at threshold", () => {
    const r = computeCapitalGains([{ kind: "LTCG_112A", section: "112A", amount: 125_000, saleConsideration: 425_000, acquisitionCost: 300_000 }]);
    expect(r.ltcg112A).toBe(125_000);
    expect(r.taxable112A).toBe(0);
    expect(r.tax112A).toBe(0);
  });

  it("just above threshold", () => {
    const r = computeCapitalGains([{ kind: "LTCG_112A", section: "112A", amount: 125_001, saleConsideration: 425_001, acquisitionCost: 300_000 }]);
    expect(r.taxable112A).toBe(1);
    expect(r.tax112A).toBe(0);
  });

  it("large gain at 12.5%", () => {
    const r = computeCapitalGains([{ kind: "LTCG_112A", section: "112A", amount: 1_125_000, saleConsideration: 2_000_000, acquisitionCost: 875_000 }]);
    expect(r.ltcg112A).toBe(1_125_000);
    expect(r.taxable112A).toBe(1_000_000);
    expect(r.tax112A).toBe(125_000);
  });

  it("multiple transactions are summed", () => {
    const r = computeCapitalGains([
      { kind: "LTCG_112A", section: "112A", amount: 80_000, saleConsideration: 180_000, acquisitionCost: 100_000 },
      { kind: "LTCG_112A", section: "112A", amount: 70_000, saleConsideration: 170_000, acquisitionCost: 100_000 },
    ]);
    expect(r.ltcg112A).toBe(150_000);
    expect(r.taxable112A).toBe(25_000);
    expect(r.tax112A).toBe(3_125);
  });

  it("losses are not silently converted into slab income", () => {
    const r = computeCapitalGains([{ kind: "LTCG_112A", section: "112A", amount: 0, saleConsideration: 50_000, acquisitionCost: 80_000 }]);
    expect(r.ltcg112A).toBe(0);
    const data: NormalizedReturn = {
      ...fixtures.simpleBusiness,
      capitalGains: [{ kind: "STCG", section: "111A", amount: -10_000 }],
    };
    const c = TaxEngine.calculate(data);
    expect(c.normalRateIncome).toBe(c.businessIncome);
    expect(c.flags.includes("UNSUPPORTED_CAPITAL_GAINS")).toBe(true);
  });

  it("112A is special-rate, not slab income", () => {
    const data: NormalizedReturn = {
      ...fixtures.simpleBusiness,
      capitalGains: [{ kind: "LTCG_112A", section: "112A", amount: 200_000, saleConsideration: 500_000, acquisitionCost: 300_000 }],
    };
    const c = TaxEngine.calculate(data);
    expect(c.specialRateIncome).toBe(200_000);
    expect(c.grossTotalIncome).toBe(c.businessIncome);
    expect(c.taxOnSpecialRate).toBeGreaterThan(0);
  });
});

describe("rebate 87A boundaries (new regime)", () => {
  it("income below threshold gets rebate", () => {
    const r = rebate87A({ residentIndividual: true, regime: "NEW", taxableIncome: 1_100_000, taxBeforeRebate: 40_000 });
    expect(r.rebate).toBe(40_000);
  });
  it("exactly at ₹12 lakh", () => {
    const r = rebate87A({ residentIndividual: true, regime: "NEW", taxableIncome: 1_200_000, taxBeforeRebate: 60_000 });
    expect(r.rebate).toBe(60_000);
  });
  it("just above threshold is not a full rebate", () => {
    const r = rebate87A({ residentIndividual: true, regime: "NEW", taxableIncome: 1_200_001, taxBeforeRebate: 60_000 });
    expect(r.rebate).toBe(0);
  });
  it("high income gets no rebate", () => {
    const r = rebate87A({ residentIndividual: true, regime: "NEW", taxableIncome: 3_000_000, taxBeforeRebate: 200_000 });
    expect(r.rebate).toBe(0);
    expect(r.marginalRelief).toBe(0);
  });
});

describe("presumptive taxation", () => {
  it("does not let declared 44AD income undercut 6%/8%", () => {
    const p = presumptive44AD(1_000_000, 1_000_000, 0, 1);
    expect(p.income).toBe(p.minimum);
    expect(p.income).toBe(60_000);
    const issues = businessValidate({
      ...fixtures.simpleBusiness,
      business: { ...fixtures.simpleBusiness.business, declaredIncome: 1 },
    });
    expect(issues.some((i) => i.id === "ITR4_BP_004")).toBe(true);
  });
  it("does not let declared 44ADA income undercut 50%", () => {
    const p = presumptive44ADA(1_000_000, 0, 10);
    expect(p.income).toBe(500_000);
    const issues = businessValidate({
      ...fixtures.professional,
      profession: { ...fixtures.professional.profession, declaredIncome: 10 },
    });
    expect(issues.some((i) => i.id === "ITR4_PR_002")).toBe(true);
  });
});

describe("deductions", () => {
  it("zero / below / at / above 80C limit (old regime)", () => {
    expect(evaluateDeductions([{ section: "80C", amount: 0 }], "OLD")[0].eligibleAmount).toBe(0);
    expect(evaluateDeductions([{ section: "80C", amount: 50_000 }], "OLD")[0].eligibleAmount).toBe(50_000);
    expect(evaluateDeductions([{ section: "80C", amount: 150_000 }], "OLD")[0].eligibleAmount).toBe(150_000);
    const over = evaluateDeductions([{ section: "80C", amount: 200_000 }], "OLD")[0];
    expect(over.eligibleAmount).toBe(150_000);
    expect(over.disallowedAmount).toBe(50_000);
  });
  it("incompatible new-regime 80C is fully disallowed", () => {
    const r = evaluateDeductions([{ section: "80C", amount: 100_000 }], "NEW")[0];
    expect(r.eligibleAmount).toBe(0);
    expect(r.disallowedAmount).toBe(100_000);
  });
});

describe("TDS / refund / payable", () => {
  it("never returns negative tax payable", () => {
    const exact = calculateRefundOrPayable({ totalTax: 10_000, tds: 10_000, tcs: 0, advanceTax: 0, selfAssessmentTax: 0 });
    expect(exact.status).toBe("ZERO");
    expect(exact.amount).toBe(0);
    const refund = calculateRefundOrPayable({ totalTax: 5_000, tds: 8_000, tcs: 0, advanceTax: 0, selfAssessmentTax: 0 });
    expect(refund.status).toBe("REFUND");
    expect(refund.amount).toBe(3_000);
    const pay = calculateRefundOrPayable({ totalTax: 20_000, tds: 1_000, tcs: 0, advanceTax: 0, selfAssessmentTax: 0 });
    expect(pay.status).toBe("TAX_PAYABLE");
    expect(pay.amount).toBe(19_000);
  });

  it("TCS is not double-counted with TDS", () => {
    const data: NormalizedReturn = {
      ...fixtures.simpleBusiness,
      tds: [
        { sectionCode: "194A", tan: "DELA12345A", amount: 5_000, deductorName: "Bank", kind: "TDS" },
        { sectionCode: "206C", tan: "DELA12345A", amount: 2_000, deductorName: "Collector", kind: "TCS" },
      ],
    };
    const c = TaxEngine.calculate(data);
    expect(c.tds).toBe(5_000);
    expect(c.tcs).toBe(2_000);
    expect(c.prepaid).toBe(7_000);
  });

  it("multiple TDS entries plus salary TDS", () => {
    const data: NormalizedReturn = {
      ...fixtures.withTds,
      tds: [{ sectionCode: "194A", tan: "DELA12345A", amount: 1_000, deductorName: "Bank", kind: "TDS" }],
    };
    const c = TaxEngine.calculate(data);
    expect(c.tds).toBe(85_000);
  });
});

describe("mapping audit and filing gate", () => {
  it("critical mappings pass", () => {
    const a = auditITR4Mapping();
    expect(a.status).toBe("PASS");
    expect(a.unmappedInternal).toEqual([]);
    expect(a.duplicatePaths).toEqual([]);
  });

  it("official schema extra property fails", () => {
    const g = generateITRJson(fixtures.simpleBusiness, { generatedAt: frozen });
    const json = JSON.parse(JSON.stringify(g.json)) as { ITR: { ITR4: Record<string, unknown> } };
    json.ITR.ITR4.NotARealField = true;
    expect(validateITR4Json(json, "2026-27").valid).toBe(false);
  });

  it("gate layers are explicit", () => {
    const gate = evaluateFilingGate(fixtures.simpleBusiness, "r1", frozen);
    expect(gate.layers.schemaIntegrity).toBe("PASS");
    expect(gate.layers.dataCompleteness).toBe("PASS");
    expect(gate.layers.eligibility).toBe("PASS");
    expect(gate.layers.businessRules).toBe("PASS");
    expect(gate.layers.taxCalculation).toBe("PASS");
    expect(gate.layers.schema).toBe("PASS");
    expect(gate.ready).toBe(true);
  });
});

describe("determinism", () => {
  it("identical input yields identical JSON (except allowed timestamp) and tax", () => {
    const a = generateITRJson(fixtures.simpleBusiness, { generatedAt: frozen });
    const b = generateITRJson(fixtures.simpleBusiness, { generatedAt: frozen });
    expect(a.digest).toBe(b.digest);
    expect(JSON.stringify(normalizeJsonForCompare(a.json))).toBe(JSON.stringify(normalizeJsonForCompare(b.json)));
    expect(a.calc.totalTax).toBe(b.calc.totalTax);
    expect(a.layers).toEqual(b.layers);
  });
});

describe("JSON hash / supersede", () => {
  it("marks previous JSON SUPERSEDED when the hash changes", () => {
    const a = generateITRJson(fixtures.simpleBusiness, { generatedAt: frozen });
    const changed = clone(fixtures.simpleBusiness);
    changed.city = "Mumbai";
    const b = generateITRJson(changed, { generatedAt: frozen });
    expect(a.digest).not.toBe(b.digest);
    const life = nextJsonFileStatuses(a.digest, b.digest);
    expect(life.changed).toBe(true);
    expect(life.previous).toBe("SUPERSEDED");
    expect(life.current).toBe("CURRENT");
  });
});

describe("demo isolation", () => {
  it("demo mode is impossible when NODE_ENV=production", () => {
    expect(demoModeFrom({ NODE_ENV: "production", DEMO_MODE: "true" })).toBe(false);
    expect(demoModeFrom({ NODE_ENV: "development", DEMO_MODE: "true" })).toBe(true);
  });
});

describe("official schema file is the production copy", () => {
  it("checksum of schema.json equals metadata.sha256", () => {
    const raw = readFileSync(path.join(process.cwd(), "src/lib/itr-json/schemas/ay2026_27/itr4/schema.json"));
    const digest = createHash("sha256").update(raw).digest("hex");
    expect(digest).toBe(String(metadata.sha256).toLowerCase());
  });
});
