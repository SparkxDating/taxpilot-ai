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
  return UNKNOWN;
}

export function extractBankCsv(text: string): BankRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase();
  if (!header.includes("date") || (!header.includes("desc") && !header.includes("narration") && !header.includes("particular"))) {
    return [];
  }
  const cols = lines[0].split(",").map((c) => c.trim().toLowerCase());
  const idx = (names: string[]) => cols.findIndex((c) => names.some((n) => c.includes(n)));
  const iDate = idx(["date"]);
  const iDesc = idx(["desc", "narration", "particular"]);
  const iDebit = idx(["debit", "withdrawal"]);
  const iCredit = idx(["credit", "deposit"]);
  const iBal = idx(["balance"]);
  const iRef = idx(["ref", "cheque", "utr"]);
  const rows: BankRow[] = [];
  for (const line of lines.slice(1)) {
    const p = line.split(",").map((x) => x.trim());
    const desc = iDesc >= 0 ? p[iDesc] || "" : "";
    rows.push({
      date: iDate >= 0 ? p[iDate] || "" : "",
      description: desc,
      debit: parseAmount(iDebit >= 0 ? p[iDebit] : "") || 0,
      credit: parseAmount(iCredit >= 0 ? p[iCredit] : "") || 0,
      balance: parseAmount(iBal >= 0 ? p[iBal] : "") || 0,
      reference: iRef >= 0 ? p[iRef] || "" : "",
      sourcePage: "csv",
      category: classifyBankDescription(desc),
    });
  }
  return rows;
}

export function extractBankText(text: string): BankRow[] {
  const csv = extractBankCsv(text);
  if (csv.length) return csv;
  return [];
}
