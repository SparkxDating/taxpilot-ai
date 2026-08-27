export function parseAmount(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const t = String(raw).replace(/[₹,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  if (!t || t === "-" || t === "NA" || t === "nil") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}
