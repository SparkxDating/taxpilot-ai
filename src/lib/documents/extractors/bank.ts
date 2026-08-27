import type { BankRow } from "../types";
import { parseAmount } from "../rupees";

const UNKNOWN = "UNKNOWN";

export function classifyBankDescription(desc: string) {
  const d = desc.toLowerCase();
  if (/salary|payroll/.test(d)) return "SALARY";
  if (/interest|int\.? cr/.test(d)) return "INTEREST";
  if (/dividend/.test(d)) return "DIVIDEND";
  if (/neft|imps|upi|transfer|rtgs/.test(d)) return "TRANSFER";
  if (/refund/.test(d)) return "REFUND";
  if (/loan|emi/.test(d)) return "LOAN";
  if (/mutual|sip|investment/.test(d)) return "INVESTMENT";
  if (/receipt|sales|customer/.test(d)) return "BUSINESS_RECEIPT";
  return UNKNOWN;
}

function row(desc: string, date: string, debit: number, credit: number, balance: number, reference: string, sourcePage: number | null): BankRow {
  const suggested = classifyBankDescription(desc);
  return {
    date,
    description: desc,
    debit,
    credit,
    balance,
    reference,
    sourcePage,
    rawCategory: UNKNOWN,
    suggestedCategory: suggested,
    verifiedCategory: null,
  };
}

export function extractBankCsv(text: string): BankRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const cols = lines[0].split(",").map((c) => c.trim().toLowerCase());
  const idx = (names: string[]) => cols.findIndex((c) => names.some((n) => c.includes(n)));
  const iDate = idx(["txn date", "transaction date", "value date", "date"]);
  const iDesc = idx(["narration", "particular", "description", "desc"]);
  const iDebit = idx(["withdrawal", "debit"]);
  const iCredit = idx(["deposit", "credit"]);
  const iBal = idx(["balance"]);
  const iRef = idx(["ref", "cheque", "utr"]);
  if (iDate < 0 || iDesc < 0) return [];
  const rows: BankRow[] = [];
  for (const line of lines.slice(1)) {
    const p = line.split(",").map((x) => x.trim());
    const desc = p[iDesc] || "";
    rows.push(
      row(
        desc,
        p[iDate] || "",
        parseAmount(iDebit >= 0 ? p[iDebit] : "") || 0,
        parseAmount(iCredit >= 0 ? p[iCredit] : "") || 0,
        parseAmount(iBal >= 0 ? p[iBal] : "") || 0,
        iRef >= 0 ? p[iRef] || "" : "",
        null,
      ),
    );
  }
  return rows;
}

export function extractBankRows(matrix: string[][], sourcePage: number | null): BankRow[] {
  if (matrix.length < 2) return [];
  const cols = matrix[0].map((c) => String(c || "").trim().toLowerCase());
  const idx = (names: string[]) => cols.findIndex((c) => names.some((n) => c.includes(n)));
  const iDate = idx(["txn date", "transaction date", "value date", "date"]);
  const iDesc = idx(["narration", "particular", "description", "desc"]);
  const iDebit = idx(["withdrawal", "debit"]);
  const iCredit = idx(["deposit", "credit"]);
  const iBal = idx(["balance"]);
  const iRef = idx(["ref", "cheque", "utr"]);
  if (iDate < 0 || iDesc < 0) return [];
  const rows: BankRow[] = [];
  for (const p of matrix.slice(1)) {
    const desc = String(p[iDesc] || "");
    rows.push(
      row(
        desc,
        String(p[iDate] || ""),
        parseAmount(iDebit >= 0 ? String(p[iDebit] || "") : "") || 0,
        parseAmount(iCredit >= 0 ? String(p[iCredit] || "") : "") || 0,
        parseAmount(iBal >= 0 ? String(p[iBal] || "") : "") || 0,
        iRef >= 0 ? String(p[iRef] || "") : "",
        sourcePage,
      ),
    );
  }
  return rows;
}

export async function extractBankXlsx(bytes: Buffer): Promise<BankRow[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(bytes, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as string[][];
  return extractBankRows(matrix, null);
}
