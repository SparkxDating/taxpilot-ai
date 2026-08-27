import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { canEnterTaxModel } from "@/lib/documents/mapping";
import {
  classifyEdit,
  importedEntry,
  pickAuthoritativeFacts,
  resetToImported,
  sectionStatus,
  shouldOverwriteFromVerified,
} from "@/lib/documents/prefill";
import { generateITRJson } from "@/lib/itr-json/mapper";
import { fixtures } from "@/lib/tax/fixtures";

const frozen = new Date("2026-08-26T00:00:00.000Z");

const verifiedSalary = {
  id: "f1",
  status: "VERIFIED",
  verified: true,
  normalizedTaxField: "salary.grossSalary",
  documentType: "FORM_16",
  value: "1250000",
  numericValue: 1_250_000,
  sourceDocumentId: "d1",
  sourcePage: "2",
};

describe("Phase 5 verified prefill", () => {
  it("prefills only VERIFIED facts and keeps provenance", () => {
    const facts = pickAuthoritativeFacts(
      [
        verifiedSalary,
        { ...verifiedSalary, id: "u1", status: "AI_EXTRACTED", verified: false, value: "1" },
        { ...verifiedSalary, id: "r1", status: "REJECTED", verified: false, value: "2" },
        { ...verifiedSalary, id: "c1", status: "CONFLICT", verified: false, value: "3" },
      ],
      new Set(),
    );
    expect(facts).toHaveLength(1);
    expect(facts[0].id).toBe("f1");
    const entry = importedEntry(verifiedSalary);
    expect(entry.origin).toBe("IMPORTED");
    expect(entry.source).toBe("FORM_16");
    expect(entry.sourcePage).toBe(2);
    expect(entry.originalValue).toBe("1250000");
  });

  it("does not treat unverified or rejected facts as authoritative", () => {
    expect(canEnterTaxModel("AI_EXTRACTED", false)).toBe(false);
    expect(canEnterTaxModel("REJECTED", false)).toBe(false);
    expect(canEnterTaxModel("CONFLICT", false)).toBe(false);
    expect(canEnterTaxModel("VERIFIED", true)).toBe(true);
  });

  it("blocks readiness on open conflict and allows processing after resolution", () => {
    expect(sectionStatus({ openConflicts: 1, needsReviewFacts: 0, missingRequired: false })).toBe("CONFLICT");
    const blocked = pickAuthoritativeFacts([verifiedSalary], new Set(["SALARY"]));
    expect(blocked).toHaveLength(0);
    const resolved = pickAuthoritativeFacts([verifiedSalary], new Set());
    expect(resolved).toHaveLength(1);
    expect(sectionStatus({ openConflicts: 0, needsReviewFacts: 0, missingRequired: false })).toBe("COMPLETE");
  });

  it("marks user edits without overwriting the original imported value", () => {
    const imported = importedEntry(verifiedSalary);
    const edited = classifyEdit(imported, "1270000");
    expect(edited.origin).toBe("USER_EDITED");
    expect(edited.originalValue).toBe("1250000");
    expect(edited.currentValue).toBe("1270000");
    expect(edited.factId).toBe("f1");
    expect(shouldOverwriteFromVerified(edited)).toBe(false);
    const reset = resetToImported(edited);
    expect(reset.origin).toBe("IMPORTED");
    expect(reset.currentValue).toBe("1250000");
  });

  it("marks manual values as USER_INPUT", () => {
    const manual = classifyEdit(undefined, "50000");
    expect(manual.origin).toBe("USER_INPUT");
    expect(manual.source).toBe("USER_INPUT");
  });

  it("calls the existing tax engine path and keeps the JSON gate authoritative", () => {
    const applySrc = readFileSync(join(process.cwd(), "src/lib/documents/applyVerified.ts"), "utf8");
    expect(applySrc).toContain("recomputeReturn");
    expect(applySrc).not.toContain("generateITRJson");
    const blocked = generateITRJson(fixtures.simpleBusiness, { generatedAt: frozen, openDocumentConflicts: 1 });
    expect(blocked.valid).toBe(false);
    expect(blocked.json).toBeNull();
    const allowed = generateITRJson(fixtures.simpleBusiness, { generatedAt: frozen, openDocumentConflicts: 0 });
    expect(allowed.valid).toBe(true);
  });
});
