/** Parse Indian/ASCII rupee amounts. Missing or unparseable → null, never 0 by default. */
export function parseAmount(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let t = String(raw).trim();
  if (!t || /^(?:-|NA|N\/A|nil|null)$/i.test(t)) return null;
  t = t.replace(/₹/g, "").replace(/rs\.?/gi, "").replace(/,/g, "").replace(/\s/g, "");
  t = t.replace(/^\((.*)\)$/, "-$1");
  if (!t || t === "-") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

export function pageRef(page: number | null | undefined): string {
  if (page == null || !Number.isFinite(page) || page <= 0) return "";
  return String(page);
}
