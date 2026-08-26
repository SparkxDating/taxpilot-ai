import { createHash } from "crypto";
import type { NormalizedReturn } from "@/lib/tax/model";
import { TaxEngine } from "@/lib/tax/engine";
import { validateAgainstOfficialSchema, validateReturn } from "@/lib/tax/validation";

export const SCHEMA_VERSION = "AY2026-27-adapter-1.0";

export function mapToOfficialJson(data: NormalizedReturn) {
  const calc = TaxEngine.calculate(data);
  const formKey = data.itrType === "ITR-3" ? "ITR3" : "ITR4";
  const created = new Date().toISOString();
  const body = {
    CreationInfo: {
      SWVersionNo: SCHEMA_VERSION,
      SWCreatedBy: "TaxPilotAI",
      JSONCreatedBy: "TaxPilotAI",
      JSONCreationDate: created.slice(0, 10),
      IntermediaryCity: data.bankAccounts[0]?.ifsc.slice(0, 4) || "",
      Digest: "",
    },
    Form_ITR4: {
      FormName: data.itrType === "ITR-3" ? "ITR-3" : "ITR-4",
      Description: data.itrType === "ITR-3" ? "ITR-3" : "ITR-4 SUGAM",
      AssessmentYear: data.assessmentYear,
      SchemaVer: SCHEMA_VERSION,
      FormVer: "1.1",
    },
    PartA_GEN1: {
      PersonalInfo: {
        AssesseeName: { FirstName: data.name },
        PAN: data.pan,
        DOB: data.dateOfBirth || "",
        Status: data.taxpayerType,
        ResidentialStatus: data.residentialStatus,
      },
    },
    PartA_GEN2: {
      FilingStatus: {
        ReturnFileSec: "11",
        OptingNewTaxRegime: data.regime === "NEW" ? "Y" : "N",
      },
    },
    PartB_TI: {
      Salaries: calc.salaryIncome,
      IncomeFromHP: calc.housePropertyIncome,
      ProfBusGain: calc.businessIncome + calc.professionIncome,
      CapGain: calc.capitalGains,
      IncFromOS: calc.otherSources,
      GrossTotInc: calc.grossTotalIncome,
      Deductions: calc.deductions,
      TotInc: calc.taxableIncome,
    },
    PartB_TTI: {
      TaxPayableOnTotInc: calc.taxBeforeRebate,
      Rebate87A: calc.rebate,
      Surcharge: calc.surcharge,
      EducationCess: calc.cess,
      GrossTaxLiability: calc.totalTax,
      TDS: calc.tds,
      AdvanceTax: calc.advanceTax,
      SelfAssessmentTax: calc.selfAssessmentTax,
      NetTaxLiability: Math.max(0, -calc.refundOrPayable),
      RefundDue: Math.max(0, calc.refundOrPayable),
    },
    ScheduleBP: {
      NatureOfBusiness: data.business.nature || data.profession.profession,
      GrossTurnover: data.business.turnover || data.profession.grossReceipts,
      PresumptiveInc44AD: calc.businessIncome,
      PresumptiveInc44ADA: calc.professionIncome,
    },
    ScheduleHP: {
      Properties: data.houseProperties,
    },
    ScheduleOS: {
      Interest: data.otherIncome.filter((o) => o.kind.toLowerCase().includes("interest")).reduce((s, o) => s + o.amount, 0),
      Dividend: data.otherIncome.filter((o) => o.kind.toLowerCase().includes("dividend")).reduce((s, o) => s + o.amount, 0),
      Other: data.otherIncome.filter((o) => !/interest|dividend/i.test(o.kind)).reduce((s, o) => s + o.amount, 0),
    },
    ScheduleBA: {
      Accounts: data.bankAccounts.map((b) => ({
        IFSCCode: b.ifsc,
        BankAccountNo: b.accountNumber,
        UseForRefund: b.isPrimary ? "true" : "false",
      })),
    },
    Verification: {
      Declaration: "I, the taxpayer, have reviewed this return prepared with software assistance.",
      Capacity: "SELF",
      Place: "",
      Date: created.slice(0, 10),
    },
  };
  const json = { ITR: { [formKey]: body } };
  const digest = createHash("sha256").update(JSON.stringify(json)).digest("hex");
  (json.ITR as Record<string, { CreationInfo: { Digest: string } }>)[formKey].CreationInfo.Digest = digest;
  return { json, digest, calc };
}

export function generateITRJson(data: NormalizedReturn) {
  const field = validateReturn(data);
  const { json, digest, calc } = mapToOfficialJson(data);
  const schema = validateAgainstOfficialSchema(json, data.assessmentYear, data.itrType);
  const blocking = [...field.issues, ...schema.errors].filter((i) => i.severity === "ERROR");
  return {
    json,
    digest,
    calc,
    schemaVersion: SCHEMA_VERSION,
    valid: blocking.length === 0 && schema.valid,
    errors: blocking,
    warnings: [...field.issues, ...schema.warnings].filter((i) => i.severity !== "ERROR"),
  };
}
