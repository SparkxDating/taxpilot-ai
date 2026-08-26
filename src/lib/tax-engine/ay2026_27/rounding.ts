/** Central rounding for ITR amounts. Do not round ad-hoc in mappers. */

function finite(n: number) {
  return Number.isFinite(n) ? n : 0;
}

export function roundIncomeAmount(n: number) {
  const v = finite(n);
  if (v < 0) return Math.round(v);
  return Math.round(v);
}

export function roundTaxAmount(n: number) {
  const v = finite(n);
  if (v < 0) return 0;
  return Math.round(v);
}

export function roundReturnAmount(n: number) {
  return Math.round(finite(n));
}
