import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { extractForm16 } from "./extractors/form16";
import { extractAis, extractTis } from "./extractors/ais";
import { classifyBankDescription, extractBankCsv } from "./extractors/bank";
import { runExtraction } from "./pipeline";
import { reconcileTds } from "./tdsReconcile";
import { classifyDocument } from "./classify";
import { canAccessDocument } from "@/lib/authz";

describe("Form 16", () => {
  it("extracts PAN, TAN, gross salary and TDS; missing stay null", () => {
    const text =
      "Form 16 Employee Name: Ravi Kumar PAN: AAAPA1234A Name of Employer: Acme Pvt Ltd TAN: MUMM12345B Assessment Year: 2026-27 Gross Salary: 12,50,000 Standard Deduction: 75,000 Tax Deducted: 1,10,000";
    const fields = extractForm16(text);
    const pan = fields.find((f) => f.field === "employeePan");
    const gross = fields.find((f) => f.field === "grossSalary");
    const tds = fields.find((f) => f.field === "tds");
    const via = fields.find((f) => f.field === "chapterVia");
    expect(pan?.value).toBe("AAAPA1234A");
    expect(gross?.numericValue).toBe(1_250_000);
    expect(tds?.numericValue).toBe(110_000);
    expect(via?.value).toBeNull();
  });
});

describe("AIS / TIS", () => {
  it("keeps AIS and TIS fields distinct and does not treat missing as zero", () => {
    const ais = extractAis("Annual Information Statement Salary: 800000 Interest: 12000 TDS: 50000");
    const tis = extractTis("Taxpayer Information Statement Reported Income: 810000 TDS: 50000");
    expect(ais.find((f) => f.field === "ais.salary")?.numericValue).toBe(800_000);
    expect(ais.find((f) => f.field === "ais.dividend")?.value).toBeNull();
    expect(tis.find((f) => f.field === "tis.reportedIncome")?.numericValue).toBe(810_000);
    expect(ais.some((f) => f.field.startsWith("tis."))).toBe(false);
  });
});

describe("bank CSV", () => {
  it("parses rows and leaves unknown category unknown", () => {
    const csv = "Date,Description,Debit,Credit,Balance\n2025-04-01,UPI to friend,500,0,10000\n2025-04-02,Salary ACME,0,80000,90000";
    const rows = extractBankCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].category).toBe("TRANSFER");
    expect(rows[1].category).toBe("SALARY");
    expect(classifyBankDescription("random coffee")).toBe("UNKNOWN");
  });
});

describe("pipeline", () => {
  it("classifies Form 16 from text and does not invent amounts", () => {
    const bytes = Buffer.from("Form 16 PAN: BBBBB1234B Gross Salary: 100000 Tax Deducted: 5000");
    const r = runExtraction({ bytes, fileName: "form16.txt", mimeType: "text/plain", declaredKind: "FORM_16" });
    expect(r.kind).toBe("FORM_16");
    expect(r.fields.find((f) => f.field === "employeePan")?.value).toBe("BBBBB1234B");
    expect(r.fields.find((f) => f.field === "chapterVia")?.value).toBeNull();
  });

  it("images require manual review", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const r = runExtraction({ bytes: png, fileName: "scan.png", mimeType: "image/png", declaredKind: "FORM_16" });
    expect(r.errorCode).toBe("MANUAL_REVIEW_REQUIRED");
    expect(r.fields).toEqual([]);
  });
});

describe("TDS reconcile", () => {
  it("flags mismatch", () => {
    expect(reconcileTds(100, 100)).toBe("MATCHED");
    expect(reconcileTds(100, 120)).toBe("MISMATCH");
    expect(reconcileTds(100, null)).toBe("MISSING");
  });
});

describe("authz documents", () => {
  it("owner only", () => {
    expect(canAccessDocument("u1", { userId: "u1", role: "USER" })).toBe(true);
    expect(canAccessDocument("u1", { userId: "u2", role: "USER" })).toBe(false);
    expect(canAccessDocument("u1", { userId: "u2", role: "ADMIN" })).toBe(true);
  });
});

describe("architectural safety", () => {
  it("document modules never import ITR JSON generation", () => {
    const dir = join(process.cwd(), "src/lib/documents");
    const files = ["pipeline.ts", "applyVerified.ts", "persistExtraction.ts", "extractors/form16.ts"];
    for (const f of files) {
      const src = readFileSync(join(dir, f), "utf8");
      expect(src).not.toContain("generateITRJson");
      expect(src).not.toContain("mapItr4Official");
    }
  });
});

describe("classify", () => {
  it("filename ais", () => {
    expect(classifyDocument("AIS-2026.pdf", "")).toBe("AIS");
    expect(classifyDocument("tis.json", "")).toBe("TIS");
  });
});
