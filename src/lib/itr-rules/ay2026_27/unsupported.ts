import type { NormalizedReturn } from "@/lib/tax/model";
import { TaxEngine } from "@/lib/tax/engine";
import { ITR4_112A_CAP, ITR4_INCOME_CAP } from "@/lib/tax-rules/ay2026_27/eligibility";

export type UnsupportedScenario = {
  code: string;
  severity: "ERROR";
  message: string;
  blocksJson: true;
  fixRoute: string;
};

export function detectUnsupported(data: NormalizedReturn, returnId = "new"): UnsupportedScenario[] {
  const id = returnId;
  const out: UnsupportedScenario[] = [];
  const block = (code: string, message: string, route = "income") => {
    out.push({ code, severity: "ERROR", message, blocksJson: true, fixRoute: `/returns/${id}/${route}` });
  };

  if (data.itrType === "ITR-3") {
    block("UNSUPPORTED_ITR3", "ITR-3 preparation is currently in development. Filing JSON generation is not available yet.", "interview");
  }
  if (data.residentialStatus === "RNOR" || data.residentialStatus === "NRI") {
    block("UNSUPPORTED_NON_RESIDENT", "ITR-4 is only for residents. RNOR/NRI are not supported for filing JSON.", "profile");
  }
  if (data.business.section === "BOOKS" || data.profession.section === "BOOKS") {
    block("UNSUPPORTED_BOOKS", "Detailed books (non-presumptive) are not supported for ITR-4 JSON.");
  }
  const otherCg = data.capitalGains.filter((g) => g.section !== "112A" && g.kind !== "LTCG_112A" && g.amount !== 0);
  if (otherCg.length) {
    block(
      "UNSUPPORTED_CAPITAL_GAIN_TYPE",
      "Capital gain calculation for this transaction type is not currently supported. Manual review is required.",
    );
  }
  const calc = TaxEngine.calculate(data);
  if (calc.capitalGains > ITR4_112A_CAP) {
    block("UNSUPPORTED_112A_OVER_CAP", "s.112A LTCG exceeds ₹1.25 lakh allowed in ITR-4.");
  }
  if (calc.grossTotalIncomeIncLtcg > ITR4_INCOME_CAP) {
    block("UNSUPPORTED_INCOME_LIMIT", "Total income exceeds the ₹50 lakh ITR-4 ceiling.");
  }
  if (data.business.section === "44AE") {
    block("UNSUPPORTED_44AE", "Section 44AE (goods carriages) is not enabled for filing JSON in this release.");
  }
  if (calc.flags.includes("UNSUPPORTED_INTEREST_CALCULATION")) {
    block(
      "UNSUPPORTED_INTEREST_CALCULATION",
      "Interest calculation requires additional information. This return requires interest calculation that TaxPilot does not currently support.",
      "tds",
    );
  }
  if (calc.flags.includes("UNSUPPORTED_CAPITAL_GAIN_DATES") || calc.flags.includes("UNSUPPORTED_CAPITAL_GAIN_HOLDING")) {
    block(
      "UNSUPPORTED_CAPITAL_GAIN_TYPE",
      "Capital gain calculation for this transaction type is not currently supported. Manual review is required. Acquisition date, sale date and holding period are required for s.112A.",
    );
  }
  if (calc.flags.includes("UNSUPPORTED_LOSS_CARRY_FORWARD")) {
    block("UNSUPPORTED_LOSS_CARRY_FORWARD", "Current-year loss carry-forward is not implemented. Manual review is required.");
  }
  return out;
}
