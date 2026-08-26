/** Sections 44AD / 44ADA / 44AE — AY 2026-27. Source: ITD ITR-4 FAQs. */
export const AD_TURNOVER_CASH_LIMIT = 20_000_000;
export const AD_TURNOVER_DIGITAL_LIMIT = 30_000_000;
export const ADA_RECEIPTS_CASH_LIMIT = 5_000_000;
export const ADA_RECEIPTS_DIGITAL_LIMIT = 7_500_000;
export const AD_RATE_CASH = 0.08;
export const AD_RATE_DIGITAL = 0.06;
export const ADA_RATE = 0.5;
export const CASH_RECEIPT_THRESHOLD = 0.05;

export function cashWithinDigitalThreshold(cash: number, total: number) {
  if (total <= 0) return true;
  return cash / total <= CASH_RECEIPT_THRESHOLD;
}

export function presumptive44AD(turnover: number, digitalReceipts: number, cashReceipts: number, declared: number) {
  const digital = Math.max(0, digitalReceipts);
  const cash = Math.max(0, cashReceipts);
  const total = turnover > 0 ? turnover : digital + cash;
  const minimum = Math.round(digital * AD_RATE_DIGITAL + cash * AD_RATE_CASH);
  const income = Math.max(minimum, declared, 0);
  const digitalOk = cashWithinDigitalThreshold(cash, total);
  const limit = digitalOk ? AD_TURNOVER_DIGITAL_LIMIT : AD_TURNOVER_CASH_LIMIT;
  return {
    total,
    minimum,
    income,
    withinLimit: total <= limit,
    limit,
    digitalOk,
  };
}

export function presumptive44ADA(grossReceipts: number, cashReceipts: number, declared: number) {
  const total = Math.max(0, grossReceipts);
  const cash = Math.max(0, cashReceipts);
  const minimum = Math.round(total * ADA_RATE);
  const income = Math.max(minimum, declared, 0);
  const digitalOk = cashWithinDigitalThreshold(cash, total);
  const limit = digitalOk ? ADA_RECEIPTS_DIGITAL_LIMIT : ADA_RECEIPTS_CASH_LIMIT;
  return {
    total,
    minimum,
    income,
    withinLimit: total <= limit,
    limit,
    digitalOk,
  };
}
