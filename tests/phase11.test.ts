import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  PROCESSABLE_DOCUMENT_TYPES,
  documentStatusView,
  extractedFactLabels,
  processableDocumentLabel,
  uploadErrorMessage,
} from "@/lib/documents/prefill";
import { isAllowedUpload } from "@/lib/documents/magic";

describe("Phase 11 document upload UX", () => {
  it("supported document upload displays Form 16, AIS, TIS, and bank statement", () => {
    expect(PROCESSABLE_DOCUMENT_TYPES).toEqual(["FORM_16", "AIS", "TIS", "BANK_STATEMENT"]);
    expect(processableDocumentLabel("FORM_16")).toBe("Form 16");
    const page = readFileSync(join(process.cwd(), "src/app/returns/[id]/documents/page.tsx"), "utf8");
    expect(page).toContain("Upload your tax documents");
    expect(page).toContain("Your verified documents can automatically populate your ITR-4 preparation.");
    expect(page).toContain("PROCESSABLE_DOCUMENT_TYPES");
  });

  it("unsupported file shows an error", () => {
    expect(isAllowedUpload("application/zip", 100).ok).toBe(false);
    expect(isAllowedUpload("application/zip", 100).code).toBe("INVALID_TYPE");
    expect(uploadErrorMessage("invalid_type")).toContain("not supported");
    expect(uploadErrorMessage("oversize")).toContain("too large");
  });

  it("processing state is displayed", () => {
    expect(documentStatusView({ status: "PROCESSING" })).toEqual({ label: "PROCESSING", prefix: "", tone: "warn" });
    const page = readFileSync(join(process.cwd(), "src/app/returns/[id]/documents/page.tsx"), "utf8");
    expect(page).toContain("Processing document…");
  });

  it("successful processing shows extracted result labels", () => {
    expect(documentStatusView({ status: "EXTRACTED" }).label).toBe("EXTRACTED");
    expect(
      extractedFactLabels([
        { field: "grossSalary", normalizedTaxField: "salary.grossSalary", value: "1250000" },
        { field: "tds", normalizedTaxField: "salary.tds", value: "12000" },
        { field: "employerName", normalizedTaxField: "salary.employerName", value: "Acme" },
      ]),
    ).toEqual(["Salary", "TDS", "Employer information"]);
  });

  it("verification CTA appears when required", () => {
    const page = readFileSync(join(process.cwd(), "src/app/returns/[id]/documents/page.tsx"), "utf8");
    expect(page).toContain("Review & Verify");
    const detail = readFileSync(join(process.cwd(), "src/app/returns/[id]/documents/[docId]/page.tsx"), "utf8");
    expect(detail).toContain("Review & Verify");
  });

  it("verified facts show that they were applied to ITR-4", () => {
    const page = readFileSync(join(process.cwd(), "src/app/returns/[id]/documents/page.tsx"), "utf8");
    expect(page).toContain("Verified information added to your ITR-4.");
    expect(page).toContain("fields updated");
  });

  it("conflict state links to existing conflict resolution", () => {
    const page = readFileSync(join(process.cwd(), "src/app/returns/[id]/documents/page.tsx"), "utf8");
    expect(page).toContain("Some information conflicts with another document.");
    expect(page).toContain("Review conflict");
    expect(page).toContain('id="conflicts"');
    expect(page).toContain("resolveConflictAction");
  });

  it("processing failure shows a safe user-facing error", () => {
    expect(documentStatusView({ status: "FAILED" }).label).toBe("FAILED");
    const page = readFileSync(join(process.cwd(), "src/app/returns/[id]/documents/page.tsx"), "utf8");
    expect(page).toContain("Document could not be processed.");
    expect(page).not.toContain("stack");
    const detail = readFileSync(join(process.cwd(), "src/app/returns/[id]/documents/[docId]/page.tsx"), "utf8");
    expect(detail).toContain("Document could not be processed.");
    expect(detail).not.toContain("stack traces");
  });

  it("duplicate document uses existing duplicate/idempotency behavior", () => {
    const actions = readFileSync(join(process.cwd(), "src/app/actions.ts"), "utf8");
    expect(actions).toContain("duplicate=1");
    const detail = readFileSync(join(process.cwd(), "src/app/returns/[id]/documents/[docId]/page.tsx"), "utf8");
    expect(detail).toContain("This document has already been processed.");
  });
});
