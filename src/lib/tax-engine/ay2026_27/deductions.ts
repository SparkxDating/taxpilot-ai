import { capDeduction, LIMITS } from "@/lib/tax-rules/ay2026_27/deductions";
import type { TaxRegime } from "@/lib/tax/model";
import { roundIncomeAmount } from "./rounding";
import { deductionAllowedInRegime } from "./regime";
import { evaluate80D } from "./deduction80d";

export type DeductionLine = {
  section: string;
  amount: number;
  beneficiary?: "SELF_FAMILY" | "PARENTS";
  kind?: "PREMIUM" | "PREVENTIVE" | "MEDICAL";
  senior?: boolean;
};

export type DeductionResult = {
  section: string;
  amount: number;
  eligibleAmount: number;
  disallowedAmount: number;
  reason: string;
};

const FAMILY_80C = ["80C", "80CCC", "80CCD(1)"];
const COMBINED_80C_CAP = 150_000;

function collect80D(lines: DeductionLine[], selfSenior: boolean) {
  const amt = (section: string) => roundIncomeAmount(lines.filter((l) => l.section === section).reduce((s, l) => s + l.amount, 0));
  const parentsSenior = lines.some((l) => l.section.startsWith("80D_PARENTS") && l.senior) || lines.some((l) => l.section === "80D_PARENTS" && l.senior === true);
  const lump = amt("80D");
  return evaluate80D({
    selfSenior,
    parentsSenior,
    selfPremium: amt("80D_SELF") + lump,
    selfPreventive: amt("80D_SELF_PREVENTIVE"),
    selfMedical: amt("80D_SELF_MEDICAL"),
    parentsPremium: amt("80D_PARENTS"),
    parentsPreventive: amt("80D_PARENTS_PREVENTIVE"),
    parentsMedical: amt("80D_PARENTS_MEDICAL"),
  });
}

export function evaluateDeductions(
  lines: DeductionLine[],
  regime: TaxRegime,
  opts?: { selfSenior?: boolean; salaryGross?: number },
): DeductionResult[] {
  const selfSenior = !!opts?.selfSenior;
  const d80 = collect80D(lines, selfSenior);
  const results: DeductionResult[] = [];
  const skip80DSections = new Set([
    "80D",
    "80D_SELF",
    "80D_SELF_PREVENTIVE",
    "80D_SELF_MEDICAL",
    "80D_PARENTS",
    "80D_PARENTS_PREVENTIVE",
    "80D_PARENTS_MEDICAL",
  ]);

  for (const d of lines) {
    const amount = roundIncomeAmount(Math.max(0, d.amount));
    if (skip80DSections.has(d.section)) continue;
    if (!deductionAllowedInRegime(d.section, regime)) {
      results.push({
        section: d.section,
        amount,
        eligibleAmount: 0,
        disallowedAmount: amount,
        reason: regime === "NEW" ? "Not allowed under the new tax regime (s.115BAC)." : "Not allowed.",
      });
      continue;
    }
    let eligible = capDeduction(d.section, amount);
    if (d.section === "80CCD(1)" && opts?.salaryGross != null && opts.salaryGross > 0) {
      eligible = Math.min(eligible, roundIncomeAmount(opts.salaryGross * 0.1));
    }
    if (d.section === "80TTA" && selfSenior) {
      results.push({
        section: d.section,
        amount,
        eligibleAmount: 0,
        disallowedAmount: amount,
        reason: "Senior citizens claim s.80TTB, not s.80TTA.",
      });
      continue;
    }
    if (d.section === "80TTB" && !selfSenior) {
      results.push({
        section: d.section,
        amount,
        eligibleAmount: 0,
        disallowedAmount: amount,
        reason: "s.80TTB is only for senior citizens.",
      });
      continue;
    }
    const limit = LIMITS[d.section as keyof typeof LIMITS];
    results.push({
      section: d.section,
      amount,
      eligibleAmount: eligible,
      disallowedAmount: amount - eligible,
      reason: eligible < amount && limit != null ? `Capped at ₹${limit.toLocaleString("en-IN")} for ${d.section}.` : "Allowed.",
    });
  }

  const claimed80D = lines.filter((l) => skip80DSections.has(l.section));
  if (claimed80D.length) {
    const amount = roundIncomeAmount(claimed80D.reduce((s, l) => s + Math.max(0, l.amount), 0));
    if (!deductionAllowedInRegime("80D", regime)) {
      results.push({
        section: "80D",
        amount,
        eligibleAmount: 0,
        disallowedAmount: amount,
        reason: "Not allowed under the new tax regime (s.115BAC).",
      });
    } else {
      results.push({
        section: "80D",
        amount,
        eligibleAmount: d80.eligibleAmount,
        disallowedAmount: d80.disallowedAmount,
        reason: [d80.self.reason, d80.parents.reason].filter((r) => r !== "Allowed.").join(" ") || "Allowed.",
      });
    }
  }

  let remaining = COMBINED_80C_CAP;
  for (const r of results) {
    if (!FAMILY_80C.includes(r.section) || r.eligibleAmount <= 0) continue;
    if (r.eligibleAmount > remaining) {
      r.disallowedAmount += r.eligibleAmount - remaining;
      r.eligibleAmount = remaining;
      r.reason = "Combined s.80C / 80CCC / 80CCD(1) ceiling of ₹1,50,000.";
    }
    remaining -= r.eligibleAmount;
  }
  return results;
}

export function totalEligible(results: DeductionResult[]) {
  return results.reduce((s, r) => s + r.eligibleAmount, 0);
}
