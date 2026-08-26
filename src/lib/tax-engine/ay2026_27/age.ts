/** Age on 31 March of the previous year. AY 2026-27 → 31 March 2026. */

export const FY_END_AY_2026_27 = "2026-03-31";

export type AgeCategory = "NORMAL" | "SENIOR_CITIZEN" | "SUPER_SENIOR_CITIZEN";

export function ageAtFinancialYearEnd(dateOfBirth: string | undefined, fyEnd = FY_END_AY_2026_27): number | null {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const [y, m, d] = dateOfBirth.split("-").map(Number);
  const [ey, em, ed] = fyEnd.split("-").map(Number);
  const dob = new Date(Date.UTC(y, m - 1, d));
  if (dob.getUTCFullYear() !== y || dob.getUTCMonth() !== m - 1 || dob.getUTCDate() !== d) return null;
  const end = new Date(Date.UTC(ey, em - 1, ed));
  if (end.getTime() < dob.getTime()) return null;
  let age = ey - y;
  if (em < m || (em === m && ed < d)) age -= 1;
  return age;
}

export function ageCategoryFromDob(dateOfBirth: string | undefined, fyEnd = FY_END_AY_2026_27): AgeCategory {
  const age = ageAtFinancialYearEnd(dateOfBirth, fyEnd);
  if (age == null) return "NORMAL";
  if (age >= 80) return "SUPER_SENIOR_CITIZEN";
  if (age >= 60) return "SENIOR_CITIZEN";
  return "NORMAL";
}

export function isSeniorCitizen(dateOfBirth: string | undefined, fyEnd = FY_END_AY_2026_27) {
  const cat = ageCategoryFromDob(dateOfBirth, fyEnd);
  return cat === "SENIOR_CITIZEN" || cat === "SUPER_SENIOR_CITIZEN";
}
