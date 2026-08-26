/**
 * Official ITR-4 AY 2026-27 rules implemented for supported scenarios.
 * Source: ITD ITR-4 FAQs + JSON schema required fields. This is PARTIAL vs the full CBDT validation PDF.
 */
export const OFFICIAL_ITR4_RULES = [
  { id: "ITR4_RULE_001", description: "Total income must not exceed ₹50 lakh", fields: ["grossTotalIncomeIncLtcg"], severity: "ERROR" as const, implemented: true },
  { id: "ITR4_RULE_002", description: "Assessee must be resident", fields: ["residentialStatus"], severity: "ERROR" as const, implemented: true },
  { id: "ITR4_RULE_003", description: "s.112A LTCG in ITR-4 cannot exceed ₹1.25 lakh", fields: ["capitalGains"], severity: "ERROR" as const, implemented: true },
  { id: "ITR4_RULE_004", description: "PAN format AAAAA9999A", fields: ["pan"], severity: "ERROR" as const, implemented: true },
  { id: "ITR4_RULE_005", description: "At least one bank account for refund", fields: ["bankAccounts"], severity: "ERROR" as const, implemented: true },
  { id: "ITR4_RULE_006", description: "44AD income at least 6%/8% of receipts", fields: ["declaredIncome"], severity: "ERROR" as const, implemented: true },
  { id: "ITR4_RULE_007", description: "44ADA income at least 50% of receipts", fields: ["declaredIncome"], severity: "ERROR" as const, implemented: true },
  { id: "ITR4_RULE_008", description: "New-regime Chapter VI-A deductions restricted", fields: ["deductions"], severity: "INFO" as const, implemented: true },
  { id: "ITR4_RULE_009", description: "112A taxed at special rate, not slabs", fields: ["specialRateIncome"], severity: "ERROR" as const, implemented: true },
  { id: "ITR4_RULE_010", description: "STCG / non-112A capital gains not permitted in ITR-4", fields: ["capitalGains"], severity: "ERROR" as const, implemented: true },
  { id: "ITR4_RULE_011", description: "ITR-4 JSON schema draft-04 structural validation", fields: ["ITR.ITR4"], severity: "ERROR" as const, implemented: true },
  { id: "ITR4_RULE_012", description: "s.234A/234B/234C interest must be computed or blocked, never silent zero when interest may apply", fields: ["IntrstPay"], severity: "ERROR" as const, implemented: true },
  { id: "ITR4_RULE_013", description: "s.234F late-filing fee from due date 31 Aug 2026 and total income", fields: ["LateFilingFee234F"], severity: "ERROR" as const, implemented: true },
  { id: "ITR4_RULE_014", description: "s.80D uses self/parents baskets and senior limits, not a flat ₹1 lakh cap", fields: ["Section80D"], severity: "ERROR" as const, implemented: true },
  { id: "ITR4_RULE_015", description: "s.80C + 80CCC + 80CCD(1) combined ceiling ₹1.5 lakh", fields: ["Section80C"], severity: "ERROR" as const, implemented: true },
] as const;
