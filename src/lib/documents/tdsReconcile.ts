export type TdsStatus = "MATCHED" | "MISMATCH" | "MISSING" | "DUPLICATE";

export function reconcileTds(form16Tds: number | null, aisTds: number | null): TdsStatus {
  if (form16Tds == null && aisTds == null) return "MISSING";
  if (form16Tds == null || aisTds == null) return "MISSING";
  if (form16Tds === aisTds) return "MATCHED";
  return "MISMATCH";
}
