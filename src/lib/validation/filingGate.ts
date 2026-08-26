import type { NormalizedReturn } from "@/lib/tax/model";
import { verifySchemaIntegrity } from "@/lib/itr-json/schemaIntegrity";
import { completenessValidate } from "./completeness";
import { businessValidate, canGenerateJson } from "./businessRules";
import { detectUnsupported } from "@/lib/itr-rules/ay2026_27/unsupported";
import { determineItrType } from "@/lib/tax-rules/ay2026_27/eligibility";
import { TaxEngine } from "@/lib/tax/engine";
import { validateITR4Json } from "@/lib/itr-json/validator/officialValidator";
import { mapItr4Official } from "@/lib/itr-json/ay2026_27/itr4/mapper";
import { auditITR4Mapping } from "@/lib/itr-json/ay2026_27/itr4/auditMapping";

export type LayerResult = "PASS" | "FAIL";

export function evaluateFilingGate(data: NormalizedReturn, returnId?: string, generatedAt?: Date) {
  const integrity = verifySchemaIntegrity();
  const completeness = completenessValidate(data, returnId);
  const unsupported = detectUnsupported(data, returnId);
  const calc = TaxEngine.calculate(data, generatedAt);
  const eligibility = determineItrType({
    taxpayerType: data.taxpayerType,
    residentialStatus: data.residentialStatus,
    isLlp: false,
    isDirector: false,
    sources: [
      data.salary.gross ? "SALARY" : "",
      data.business.turnover || data.business.digitalReceipts ? "BUSINESS" : "",
      data.profession.grossReceipts ? "PROFESSION" : "",
    ].filter(Boolean),
    totalIncome: calc.grossTotalIncomeIncLtcg,
    housePropertyCount: data.houseProperties.length,
    ltcg112A: calc.capitalGains,
    stcg: data.capitalGains.filter((g) => g.kind === "STCG").reduce((s, g) => s + g.amount, 0),
    otherLtcg: data.capitalGains.filter((g) => g.section !== "112A" && g.kind !== "LTCG_112A").reduce((s, g) => s + g.amount, 0),
    agriculturalIncome: 0,
    lotteryOrRacehorse: false,
    foreignAssets: false,
    unlistedShares: false,
    businessTurnover: data.business.turnover,
    businessCash: data.business.cashReceipts,
    professionReceipts: data.profession.grossReceipts,
    professionCash: data.profession.cashReceipts,
    usesPresumptive: true,
    detailedBooks: data.business.section === "BOOKS",
    fnoTrading: false,
  });
  const business = businessValidate(data, returnId);
  const taxFail =
    calc.totalTax < 0 ||
    calc.flags.includes("UNSUPPORTED_CAPITAL_GAINS") ||
    calc.flags.includes("UNSUPPORTED_LOSS_CARRY_FORWARD") ||
    calc.flags.includes("UNSUPPORTED_INTEREST_CALCULATION") ||
    calc.flags.includes("UNSUPPORTED_CAPITAL_GAIN_DATES") ||
    calc.flags.includes("UNSUPPORTED_CAPITAL_GAIN_HOLDING");
  const mapping = auditITR4Mapping();

  let official: ReturnType<typeof validateITR4Json> = {
    valid: false,
    errors: [],
    warnings: [],
    schemaVersion: "",
    schemaMode: "OfficialSchema",
  };
  let json: unknown = null;
  const preOk =
    integrity.ok &&
    completeness.length === 0 &&
    unsupported.length === 0 &&
    (data.itrType !== "ITR-4" || eligibility.itr4Eligible) &&
    canGenerateJson(business) &&
    !taxFail &&
    mapping.status !== "ERROR";

  if (data.itrType === "ITR-4" && preOk) {
    const mapped = mapItr4Official(data, generatedAt);
    json = mapped.json;
    official = validateITR4Json(mapped.json, data.assessmentYear);
  }

  const layers = {
    schemaIntegrity: (integrity.ok ? "PASS" : "FAIL") as LayerResult,
    dataCompleteness: (completeness.length === 0 ? "PASS" : "FAIL") as LayerResult,
    eligibility: (data.itrType === "ITR-4" && eligibility.itr4Eligible ? "PASS" : "FAIL") as LayerResult,
    businessRules: (canGenerateJson(business) ? "PASS" : "FAIL") as LayerResult,
    taxCalculation: (!taxFail ? "PASS" : "FAIL") as LayerResult,
    unsupported: (unsupported.length === 0 ? "PASS" : "FAIL") as LayerResult,
    schema: (official.valid ? "PASS" : "FAIL") as LayerResult,
    mapping: (mapping.status === "PASS" ? "PASS" : "FAIL") as LayerResult,
  };

  const ready =
    layers.schemaIntegrity === "PASS" &&
    layers.dataCompleteness === "PASS" &&
    layers.eligibility === "PASS" &&
    layers.businessRules === "PASS" &&
    layers.taxCalculation === "PASS" &&
    layers.unsupported === "PASS" &&
    layers.schema === "PASS" &&
    layers.mapping === "PASS";

  return { ready, layers, integrity, completeness, unsupported, eligibility, business, calc, official, json, mapping };
}
