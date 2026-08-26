/** s.234F late-filing fee. AY 2026-27: ₹1,000 if TI ≤ ₹5 lakh, else ₹5,000. */
export const FEE_234F_LOW = 1_000;
export const FEE_234F_HIGH = 5_000;
export const FEE_234F_INCOME_CAP = 500_000;

export function fee234F(opts: { filingDate: Date; dueDate: Date; taxableIncome: number }) {
  if (opts.filingDate.getTime() <= opts.dueDate.getTime()) {
    return { amount: 0, applicable: false };
  }
  const amount = opts.taxableIncome <= FEE_234F_INCOME_CAP ? FEE_234F_LOW : FEE_234F_HIGH;
  return { amount, applicable: true };
}
