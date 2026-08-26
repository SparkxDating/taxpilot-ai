import { roundIncomeAmount } from "./rounding";

/** s.80D AY 2026-27. Preventive check-up ₹5,000 inside the basket. Medical expenditure only for seniors without insurance. */
export const D80_NON_SENIOR = 25_000;
export const D80_SENIOR = 50_000;
export const D80_PREVENTIVE_CAP = 5_000;

export type Deduction80DInput = {
  selfSenior: boolean;
  parentsSenior: boolean;
  selfPremium: number;
  selfPreventive: number;
  selfMedical: number;
  parentsPremium: number;
  parentsPreventive: number;
  parentsMedical: number;
};

export type Deduction80DBasket = {
  beneficiary: "SELF_FAMILY" | "PARENTS";
  senior: boolean;
  limit: number;
  premium: number;
  preventive: number;
  medical: number;
  eligible: number;
  disallowed: number;
  reason: string;
};

function basket(
  beneficiary: "SELF_FAMILY" | "PARENTS",
  senior: boolean,
  premiumRaw: number,
  preventiveRaw: number,
  medicalRaw: number,
): Deduction80DBasket {
  const premium = roundIncomeAmount(Math.max(0, premiumRaw));
  const preventive = roundIncomeAmount(Math.max(0, preventiveRaw));
  const medical = roundIncomeAmount(Math.max(0, medicalRaw));
  const limit = senior ? D80_SENIOR : D80_NON_SENIOR;
  const preventiveElig = Math.min(preventive, D80_PREVENTIVE_CAP);
  let medicalElig = 0;
  const reasons: string[] = [];
  if (medical > 0 && !senior) {
    reasons.push("Medical expenditure under s.80D is only for senior citizens.");
  } else if (medical > 0 && premium > 0) {
    reasons.push("Medical expenditure is allowed only where no health-insurance premium is paid for that person.");
  } else if (medical > 0 && senior && premium === 0) {
    medicalElig = medical;
  }
  let eligible = premium + preventiveElig + medicalElig;
  if (eligible > limit) {
    reasons.push(`Basket capped at ₹${limit.toLocaleString("en-IN")} (${senior ? "senior" : "non-senior"}).`);
    eligible = limit;
  }
  const claimed = premium + preventive + medical;
  return {
    beneficiary,
    senior,
    limit,
    premium,
    preventive,
    medical,
    eligible,
    disallowed: Math.max(0, claimed - eligible),
    reason: reasons.join(" ") || "Allowed.",
  };
}

export function evaluate80D(input: Deduction80DInput) {
  const self = basket("SELF_FAMILY", input.selfSenior, input.selfPremium, input.selfPreventive, input.selfMedical);
  const parents = basket(
    "PARENTS",
    input.parentsSenior,
    input.parentsPremium,
    input.parentsPreventive,
    input.parentsMedical,
  );
  return {
    self,
    parents,
    eligibleAmount: self.eligible + parents.eligible,
    disallowedAmount: self.disallowed + parents.disallowed,
  };
}
