import type { DocumentType } from "./types";

export function classifyDocument(fileName: string, text: string, declared?: string): DocumentType {
  const n = `${fileName} ${text}`.toLowerCase();
  if (declared && declared !== "OTHER") {
    const d = declared as DocumentType;
    return d;
  }
  if (n.includes("form 16") || n.includes("form16") || /form[\s_-]?16/.test(n)) return "FORM_16";
  if (/\bais\b/.test(n) || n.includes("annual information")) return "AIS";
  if (/\btis\b/.test(n) || n.includes("taxpayer information")) return "TIS";
  if (n.includes("bank") || n.includes("statement") || n.includes("passbook")) return "BANK_STATEMENT";
  if (n.includes("26as") || n.includes("form 26")) return "FORM_26AS";
  if (n.includes("salary slip") || n.includes("payslip")) return "SALARY_SLIP";
  return "OTHER";
}
