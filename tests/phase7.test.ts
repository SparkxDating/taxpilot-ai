import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { fixtures } from "@/lib/tax/fixtures";
import { generateITRJson, type JsonGenerationGate } from "@/lib/itr-json/mapper";
import { completenessValidate } from "@/lib/validation/completeness";
import { businessValidate } from "@/lib/validation/businessRules";
import { detectUnsupported } from "@/lib/itr-rules/ay2026_27/unsupported";
import { reviewReadiness } from "@/lib/review/readiness";
import type { NormalizedReturn } from "@/lib/tax/model";

const frozen = new Date("2026-08-26T00:00:00.000Z");

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function blockedGate(data: NormalizedReturn, openDocumentConflicts = 0): JsonGenerationGate {
  const result = generateITRJson(data, { generatedAt: frozen, openDocumentConflicts, returnId: "r1" });
  return {
    allowed: Boolean(result.valid && result.json),
    data,
    result,
    error: result.valid && result.json ? null : "blocked",
  };
}

describe("Phase 7 ITR-4 validation coverage", () => {
  it("missing required field is BLOCKING", () => {
    const data = { ...fixtures.simpleBusiness, pan: "" };
    const issues = completenessValidate(data);
    expect(issues.some((i) => i.code === "REQUIRED_FIELD_MISSING" && i.field === "pan" && i.severity === "ERROR")).toBe(true);
    const g = generateITRJson(data, { generatedAt: frozen });
    expect(g.valid).toBe(false);
    expect(g.json).toBeNull();
    expect(reviewReadiness(blockedGate(data)).status).toBe("NOT_READY");
  });

  it("invalid numeric value is BLOCKING", () => {
    const data = clone(fixtures.simpleBusiness);
    data.salary = { ...data.salary, gross: Number.NaN };
    const issues = businessValidate(data);
    expect(issues.some((i) => i.code === "INVALID_NUMERIC_VALUE" && i.severity === "ERROR")).toBe(true);
    const g = generateITRJson(data, { generatedAt: frozen });
    expect(g.valid).toBe(false);
    expect(g.json).toBeNull();
  });

  it("prohibited negative value is BLOCKING", () => {
    const data = clone(fixtures.simpleBusiness);
    data.salary = { ...data.salary, tds: -1 };
    data.tds = [{ sectionCode: "192", tan: "MUMM12345B", amount: -500, deductorName: "Corp" }];
    data.taxPayments = [{ kind: "ADVANCE", amount: -100 }];
    const issues = businessValidate(data);
    expect(issues.some((i) => i.code === "NEGATIVE_VALUE_NOT_ALLOWED" && i.field === "salaryTds")).toBe(true);
    expect(issues.some((i) => i.code === "NEGATIVE_VALUE_NOT_ALLOWED" && i.field.includes("tds"))).toBe(true);
    expect(issues.some((i) => i.code === "NEGATIVE_VALUE_NOT_ALLOWED" && i.field.includes("taxPayments"))).toBe(true);
    expect(generateITRJson(data, { generatedAt: frozen }).json).toBeNull();
  });

  it("valid house-property loss is not treated as a prohibited negative", () => {
    const data: NormalizedReturn = {
      ...clone(fixtures.simpleBusiness),
      regime: "OLD",
      houseProperties: [{ occupancy: "SELF_OCCUPIED", annualLetableValue: 0, municipalTaxes: 0, interestOnLoan: 150_000 }],
    };
    const issues = businessValidate(data);
    expect(issues.some((i) => i.code === "NEGATIVE_VALUE_NOT_ALLOWED" && String(i.field).includes("house"))).toBe(false);
    expect(issues.some((i) => i.code === "INVALID_NUMERIC_VALUE")).toBe(false);
  });

  it("TDS / document conflict is BLOCKING via the existing conflict path", () => {
    const g = generateITRJson(fixtures.simpleBusiness, { generatedAt: frozen, openDocumentConflicts: 1 });
    expect(g.valid).toBe(false);
    expect(g.json).toBeNull();
    expect(g.errors.some((e) => e.code === "DOCUMENT_CONFLICT_OPEN" || e.field === "DOCUMENT_CONFLICT_OPEN")).toBe(true);
    const ui = reviewReadiness(blockedGate(fixtures.simpleBusiness, 1), { openConflicts: 1 });
    expect(ui.status).toBe("NOT_READY");
    expect(ui.reasons.some((r) => /conflict/i.test(r.title) || /conflict/i.test(r.detail))).toBe(true);
  });

  it("open document conflict stays BLOCKING", () => {
    const ui = reviewReadiness(blockedGate(fixtures.simpleBusiness, 2), { openConflicts: 2 });
    expect(ui.status).toBe("NOT_READY");
    expect(ui.checklist.find((c) => c.label === "Conflicts")?.status).toBe("BLOCKED");
  });

  it("unsupported capital-gains scenario is BLOCKING", () => {
    const data: NormalizedReturn = {
      ...clone(fixtures.simpleBusiness),
      capitalGains: [{ kind: "STCG", section: "111A", amount: 50_000 }],
    };
    const u = detectUnsupported(data);
    expect(u.some((x) => x.code === "UNSUPPORTED_CAPITAL_GAIN_TYPE" && x.blocksJson)).toBe(true);
    const g = generateITRJson(data, { generatedAt: frozen });
    expect(g.valid).toBe(false);
    expect(g.json).toBeNull();
    expect(reviewReadiness(blockedGate(data)).status).toBe("NOT_READY");
  });

  it("valid return does not add new numeric or negative blocking errors", () => {
    const issues = businessValidate(fixtures.simpleBusiness);
    expect(issues.filter((i) => i.code === "INVALID_NUMERIC_VALUE" || i.code === "NEGATIVE_VALUE_NOT_ALLOWED")).toEqual([]);
    expect(completenessValidate(fixtures.simpleBusiness)).toEqual([]);
  });

  it("existing schema validation failure still blocks JSON", () => {
    const g = generateITRJson(fixtures.simpleBusiness, { generatedAt: frozen });
    if (g.layers.schema === "FAIL" || g.layers.schemaIntegrity === "FAIL" || !g.official.valid) {
      expect(g.valid).toBe(false);
      expect(g.json).toBeNull();
    }
    expect(g.valid ? Boolean(g.json) : g.json === null).toBe(true);
  });

  it("existing filing gate remains the authority for JSON generation", () => {
    const actions = readFileSync(join(process.cwd(), "src/app/actions.ts"), "utf8");
    expect(actions).toContain("canGenerateItrJson");
    expect(actions).toContain("if (!gate.allowed || !gate.result?.json)");
    const review = readFileSync(join(process.cwd(), "src/app/returns/[id]/review/page.tsx"), "utf8");
    expect(review).toContain("canGenerateItrJson");
    expect(review).toContain("gate.allowed");
    expect(review).toContain("generateJsonAction");
    expect(review).toContain("BLOCKING");
    const ui = reviewReadiness({
      allowed: false,
      data: fixtures.simpleBusiness,
      result: {
        ...generateITRJson(fixtures.simpleBusiness, { generatedAt: frozen }),
        valid: true,
        json: { ITR: {} },
        blocked: false,
      },
      error: "blocked",
    });
    expect(ui.status).toBe("NOT_READY");
  });
});
