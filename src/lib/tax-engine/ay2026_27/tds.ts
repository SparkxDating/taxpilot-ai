import { roundTaxAmount } from "./rounding";

export type CreditLine = { amount: number; kind?: string };

export function totalTds(salaryTds: number, entries: CreditLine[]) {
  const other = entries.filter((e) => e.kind !== "TCS").reduce((s, e) => s + Math.max(0, e.amount), 0);
  return roundTaxAmount(Math.max(0, salaryTds) + other);
}

export function totalTcs(entries: CreditLine[]) {
  return roundTaxAmount(entries.filter((e) => e.kind === "TCS").reduce((s, e) => s + Math.max(0, e.amount), 0));
}
