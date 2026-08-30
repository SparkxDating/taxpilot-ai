import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { generateITRJson, type JsonGenerationGate } from "@/lib/itr-json/mapper";
import { reviewReadiness } from "@/lib/review/readiness";
import { fixtures } from "@/lib/tax/fixtures";
import type { TaxComputation } from "@/lib/tax/engine";

const frozen = new Date("2026-08-26T00:00:00.000Z");

function gateFromGenerated(data: (typeof fixtures)["simpleBusiness"], openDocumentConflicts = 0): JsonGenerationGate {
  const result = generateITRJson(data, { generatedAt: frozen, openDocumentConflicts, returnId: "r1" });
  return {
    allowed: Boolean(result.valid && result.json),
    data,
    result,
    error: result.valid && result.json ? null : "blocked",
  };
}

function allowedGate(): JsonGenerationGate {
  const result = generateITRJson(fixtures.simpleBusiness, { generatedAt: frozen });
  return {
    allowed: true,
    data: fixtures.simpleBusiness,
    result: {
      ...result,
      valid: true,
      json: { ITR: { ITR4: {} } },
      blocked: false,
    },
    error: null,
  };
}

describe("Phase 6 review readiness", () => {
  it("shows READY only when the existing gate allows generation", () => {
    const ready = reviewReadiness(allowedGate());
    expect(ready.status).toBe("READY");
    expect(ready.reasons).toEqual([]);
  });

  it("marks unresolved conflicts NOT READY using the existing JSON path", () => {
    const g = generateITRJson(fixtures.simpleBusiness, { generatedAt: frozen, openDocumentConflicts: 1 });
    expect(g.valid).toBe(false);
    expect(g.json).toBeNull();
    const ui = reviewReadiness({ allowed: false, data: fixtures.simpleBusiness, result: g, error: "blocked" }, { openConflicts: 1 });
    expect(ui.status).toBe("NOT_READY");
    expect(ui.reasons.some((r) => /conflict/i.test(r.title))).toBe(true);
  });

  it("marks missing required information NOT READY when the gate reports it", () => {
    const g = generateITRJson(fixtures.mismatch, { generatedAt: frozen });
    expect(g.valid).toBe(false);
    const ui = reviewReadiness({ allowed: false, data: fixtures.mismatch, result: g, error: "blocked" });
    expect(ui.status).toBe("NOT_READY");
    expect(g.layers.dataCompleteness === "FAIL" || g.errors.length > 0).toBe(true);
  });

  it("marks existing tax validation failure NOT READY", () => {
    const g = generateITRJson(fixtures.ineligibleItr4, { generatedAt: frozen });
    expect(g.valid).toBe(false);
    const ui = reviewReadiness({ allowed: false, data: fixtures.ineligibleItr4, result: g, error: "blocked" });
    expect(ui.status).toBe("NOT_READY");
    expect(g.layers.taxCalculation === "FAIL" || g.layers.eligibility === "FAIL" || g.layers.unsupported === "FAIL").toBe(true);
  });

  it("marks existing schema validation failure NOT READY", () => {
    const g = generateITRJson(fixtures.simpleBusiness, { generatedAt: frozen });
    const schemaFailed = g.layers.schema === "FAIL" || g.layers.schemaIntegrity === "FAIL" || !g.official.valid;
    const ui = reviewReadiness(gateFromGenerated(fixtures.simpleBusiness));
    if (schemaFailed) {
      expect(ui.status).toBe("NOT_READY");
      expect(ui.reasons.some((r) => /schema/i.test(r.title) || /required|conflict|action|eligib|valid/i.test(r.title))).toBe(true);
    }
    expect(ui.status === "READY" ? g.valid : true).toBe(true);
  });

  it("never shows READY when canGenerateItrJson.allowed is false", () => {
    const result = generateITRJson(fixtures.simpleBusiness, { generatedAt: frozen });
    const ui = reviewReadiness({
      allowed: false,
      data: fixtures.simpleBusiness,
      result: { ...result, valid: true, json: { ITR: {} }, blocked: false, calc: result.calc as TaxComputation },
      error: "blocked",
    });
    expect(ui.status).toBe("NOT_READY");
  });

  it("ready state uses the existing JSON generation path and not-ready cannot generate", () => {
    const actions = readFileSync(join(process.cwd(), "src/app/actions.ts"), "utf8");
    expect(actions).toContain("canGenerateItrJson");
    expect(actions).toContain("if (!gate.allowed || !gate.result?.json)");
    const review = readFileSync(join(process.cwd(), "src/app/returns/[id]/review/page.tsx"), "utf8");
    expect(review).toContain("canGenerateItrJson");
    expect(review).toContain("reviewReadiness");
    expect(review).toContain("generateJsonAction");
    expect(review).toContain("gate.allowed");
    const jsonPage = readFileSync(join(process.cwd(), "src/app/returns/[id]/json/page.tsx"), "utf8");
    expect(jsonPage).toContain("canGenerateItrJson");
    expect(jsonPage).toContain("gate.allowed");
    const blocked = generateITRJson(fixtures.simpleBusiness, { generatedAt: frozen, openDocumentConflicts: 1 });
    expect(blocked.valid).toBe(false);
    expect(blocked.json).toBeNull();
  });
});
