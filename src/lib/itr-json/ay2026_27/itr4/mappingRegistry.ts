export type MappingRow = {
  internalField: string;
  itrPath: string;
  type: "string" | "number" | "enum" | "object" | "array" | "boolean";
  transformation: string;
  source: string;
  required: boolean;
  validationRule: string;
  testFixture: string;
};

export const ITR4_MAPPING_REGISTRY: MappingRow[] = [
  { internalField: "pan", itrPath: "ITR.ITR4.PersonalInfo.PAN", type: "string", transformation: "uppercase PAN", source: "Profile.pan", required: true, validationRule: "ITR4_RULE_004", testFixture: "simple" },
  { internalField: "name", itrPath: "ITR.ITR4.PersonalInfo.AssesseeName", type: "object", transformation: "split first/last; never NA", source: "User.name", required: true, validationRule: "ITR4_REQ_NAME", testFixture: "simple" },
  { internalField: "dateOfBirth", itrPath: "ITR.ITR4.PersonalInfo.DOB", type: "string", transformation: "YYYY-MM-DD; error if missing", source: "Profile.dateOfBirth", required: true, validationRule: "ITR4_REQ_DATEOFBIRTH", testFixture: "simple" },
  { internalField: "fatherName", itrPath: "ITR.ITR4.Verification.Declaration.FatherName", type: "string", transformation: "as entered", source: "Profile.fatherName", required: true, validationRule: "ITR4_REQ_FATHERNAME", testFixture: "simple" },
  { internalField: "email", itrPath: "ITR.ITR4.PersonalInfo.Address.EmailAddress", type: "string", transformation: "as entered", source: "User.email", required: true, validationRule: "ITR4_REQ_EMAIL", testFixture: "simple" },
  { internalField: "phone", itrPath: "ITR.ITR4.PersonalInfo.Address.MobileNo", type: "number", transformation: "10-digit integer", source: "Profile.phone", required: true, validationRule: "ITR4_REQ_PHONE", testFixture: "simple" },
  { internalField: "city", itrPath: "ITR.ITR4.PersonalInfo.Address.CityOrTownOrDistrict", type: "string", transformation: "as entered", source: "Profile.city", required: true, validationRule: "ITR4_REQ_CITY", testFixture: "simple" },
  { internalField: "state", itrPath: "ITR.ITR4.PersonalInfo.Address.StateCode", type: "enum", transformation: "state name → official code", source: "Profile.state", required: true, validationRule: "ITR4_REQ_STATE", testFixture: "simple" },
  { internalField: "pincode", itrPath: "ITR.ITR4.PersonalInfo.Address.PinCode", type: "number", transformation: "6-digit integer", source: "Profile.pincode", required: true, validationRule: "ITR4_REQ_PINCODE", testFixture: "simple" },
  { internalField: "regime", itrPath: "ITR.ITR4.FilingStatus.Form10IEAEarlierAYOldRegime", type: "enum", transformation: "NEW→NA OLD→Y", source: "TaxReturn.taxRegime", required: true, validationRule: "ITR4_RULE_008", testFixture: "simple" },
  { internalField: "salary.gross", itrPath: "ITR.ITR4.IncomeDeductions.GrossSalary", type: "number", transformation: "integer rupees", source: "SalaryIncome.grossSalary", required: true, validationRule: "ITR4_RULE_011", testFixture: "salaryPlusBusiness" },
  { internalField: "salary.tds", itrPath: "ITR.ITR4.TDSonSalaries.TotalTDSonSalaries", type: "number", transformation: "integer rupees", source: "SalaryIncome.tds", required: false, validationRule: "ITR4_TDS_001", testFixture: "withTds" },
  { internalField: "business.turnover", itrPath: "ITR.ITR4.ScheduleBP.PersumptiveInc44AD.GrsTotalTrnOver", type: "number", transformation: "integer rupees", source: "BusinessIncome.turnover", required: false, validationRule: "ITR4_BP_001", testFixture: "simple" },
  { internalField: "business.digitalReceipts", itrPath: "ITR.ITR4.ScheduleBP.PersumptiveInc44AD.GrsTrnOverBank", type: "number", transformation: "integer rupees", source: "BusinessIncome.digitalReceipts", required: false, validationRule: "ITR4_BP_001", testFixture: "simple" },
  { internalField: "business.cashReceipts", itrPath: "ITR.ITR4.ScheduleBP.PersumptiveInc44AD.GrsTotalTrnOverInCash", type: "number", transformation: "integer rupees", source: "BusinessIncome.cashReceipts", required: false, validationRule: "ITR4_BP_001", testFixture: "simple" },
  { internalField: "business.natureCode", itrPath: "ITR.ITR4.ScheduleBP.NatOfBus44AD.CodeAD", type: "enum", transformation: "official enum only", source: "BusinessIncome.nature", required: false, validationRule: "ITR4_REQ_NATURECODE", testFixture: "simple" },
  { internalField: "calc.businessIncome", itrPath: "ITR.ITR4.ScheduleBP.PersumptiveInc44AD.TotPersumptiveInc44AD", type: "number", transformation: "max(6%/8% minimum, declared)", source: "presumptive44AD", required: false, validationRule: "ITR4_RULE_006", testFixture: "simple" },
  { internalField: "profession.grossReceipts", itrPath: "ITR.ITR4.ScheduleBP.PersumptiveInc44ADA.GrsReceipt", type: "number", transformation: "integer rupees", source: "ProfessionalIncome.grossReceipts", required: false, validationRule: "ITR4_RULE_007", testFixture: "professional" },
  { internalField: "calc.professionIncome", itrPath: "ITR.ITR4.ScheduleBP.PersumptiveInc44ADA.TotPersumptiveInc44ADA", type: "number", transformation: "max(50% minimum, declared)", source: "presumptive44ADA", required: false, validationRule: "ITR4_RULE_007", testFixture: "professional" },
  { internalField: "calc.salaryIncome", itrPath: "ITR.ITR4.IncomeDeductions.IncomeFromSal", type: "number", transformation: "gross - exemptions - std deduction", source: "TaxEngine", required: true, validationRule: "ITR4_RULE_011", testFixture: "salaryPlusBusiness" },
  { internalField: "calc.housePropertyIncome", itrPath: "ITR.ITR4.IncomeDeductions.TotalIncomeChargeableUnHP", type: "number", transformation: "NAV - 30% - interest", source: "TaxEngine", required: true, validationRule: "ITR4_RULE_011", testFixture: "house-property" },
  { internalField: "calc.otherSources", itrPath: "ITR.ITR4.IncomeDeductions.IncomeOthSrc", type: "number", transformation: "sum", source: "OtherIncome", required: true, validationRule: "ITR4_RULE_011", testFixture: "businessInterest" },
  { internalField: "calc.capitalGains", itrPath: "ITR.ITR4.LTCG112A.LongCap112A", type: "number", transformation: "special-rate, not slab income", source: "CapitalGain 112A", required: false, validationRule: "ITR4_RULE_009", testFixture: "capital-gains" },
  { internalField: "calc.deductions", itrPath: "ITR.ITR4.IncomeDeductions.DeductUndChapVIA.TotalChapVIADeductions", type: "number", transformation: "sum of eligible amounts", source: "Deduction", required: true, validationRule: "ITR4_RULE_008", testFixture: "simple" },
  { internalField: "calc.taxBeforeRebate", itrPath: "ITR.ITR4.TaxComputation.TotalTaxPayable", type: "number", transformation: "slabs on normal-rate income", source: "TaxEngine", required: true, validationRule: "ITR4_RULE_011", testFixture: "simple" },
  { internalField: "calc.rebate", itrPath: "ITR.ITR4.TaxComputation.Rebate87A", type: "number", transformation: "s.87A AY 2026-27", source: "TaxEngine", required: true, validationRule: "ITR4_RULE_011", testFixture: "simple" },
  { internalField: "calc.cess", itrPath: "ITR.ITR4.TaxComputation.EducationCess", type: "number", transformation: "4% HEC roundTaxAmount", source: "TaxEngine", required: true, validationRule: "ITR4_RULE_011", testFixture: "simple" },
  { internalField: "calc.tds", itrPath: "ITR.ITR4.TaxPaid.TaxesPaid.TDS", type: "number", transformation: "sum", source: "Salary TDS + TDSEntry", required: true, validationRule: "ITR4_TDS_001", testFixture: "withTds" },
  { internalField: "bankAccounts", itrPath: "ITR.ITR4.Refund.BankAccountDtls.AddtnlBankDetails", type: "array", transformation: "mask in UI", source: "BankAccount", required: true, validationRule: "ITR4_RULE_005", testFixture: "simple" },
  { internalField: "calc.totalTax", itrPath: "ITR.ITR4.TaxComputation.GrossTaxLiability", type: "number", transformation: "roundTaxAmount", source: "TaxEngine", required: true, validationRule: "ITR4_RULE_011", testFixture: "simple" },
  { internalField: "calc.advanceTax", itrPath: "ITR.ITR4.TaxPaid.TaxesPaid.AdvanceTax", type: "number", transformation: "sum ADVANCE", source: "TaxPayment", required: true, validationRule: "ITR4_TDS_001", testFixture: "tax-payable" },
  { internalField: "calc.selfAssessmentTax", itrPath: "ITR.ITR4.TaxPaid.TaxesPaid.SelfAssessmentTax", type: "number", transformation: "sum SELF_ASSESSMENT", source: "TaxPayment", required: true, validationRule: "ITR4_TDS_001", testFixture: "tax-payable" },
  { internalField: "calc.tcs", itrPath: "ITR.ITR4.TaxPaid.TaxesPaid.TCS", type: "number", transformation: "sum kind=TCS only", source: "TDSEntry", required: true, validationRule: "ITR4_TDS_001", testFixture: "withTds" },
  { internalField: "settlement.refund", itrPath: "ITR.ITR4.Refund.RefundDue", type: "number", transformation: "REFUND amount or 0", source: "calculateRefundOrPayable", required: true, validationRule: "ITR4_RULE_011", testFixture: "refund" },
  { internalField: "settlement.payable", itrPath: "ITR.ITR4.TaxPaid.BalTaxPayable", type: "number", transformation: "TAX_PAYABLE amount or 0", source: "calculateRefundOrPayable", required: true, validationRule: "ITR4_RULE_011", testFixture: "tax-payable" },
  { internalField: "verification.name", itrPath: "ITR.ITR4.Verification.Declaration.AssesseeVerName", type: "string", transformation: "as entered", source: "User.name", required: true, validationRule: "ITR4_REQ_NAME", testFixture: "simple" },
];

export const CRITICAL_INTERNAL_FIELDS = [
  "pan",
  "name",
  "dateOfBirth",
  "fatherName",
  "email",
  "phone",
  "city",
  "state",
  "pincode",
  "bankAccounts",
];
