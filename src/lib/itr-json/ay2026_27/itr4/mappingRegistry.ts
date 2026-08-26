export type MappingRow = {
  internalField: string;
  itrField: string;
  source: string;
  transformation: string;
};

export const ITR4_MAPPING_REGISTRY: MappingRow[] = [
  { internalField: "pan", itrField: "ITR.ITR4.PersonalInfo.PAN", source: "Profile.pan", transformation: "uppercase" },
  { internalField: "name", itrField: "ITR.ITR4.PersonalInfo.AssesseeName", source: "User.name", transformation: "split first/last" },
  { internalField: "dateOfBirth", itrField: "ITR.ITR4.PersonalInfo.DOB", source: "Profile.dateOfBirth", transformation: "YYYY-MM-DD" },
  { internalField: "regime", itrField: "ITR.ITR4.FilingStatus.Form10IEAEarlierAYOldRegime", source: "TaxReturn.taxRegime", transformation: "NEW→NA old-regime flags" },
  { internalField: "salary.gross", itrField: "ITR.ITR4.IncomeDeductions.GrossSalary", source: "SalaryIncome.grossSalary", transformation: "integer rupees" },
  { internalField: "salary.tds", itrField: "ITR.ITR4.TDSonSalaries.TotalTDSonSalaries", source: "SalaryIncome.tds", transformation: "integer rupees" },
  { internalField: "business.turnover", itrField: "ITR.ITR4.ScheduleBP.PersumptiveInc44AD.GrsTotalTrnOver", source: "BusinessIncome.turnover", transformation: "integer rupees" },
  { internalField: "business.digitalReceipts", itrField: "ITR.ITR4.ScheduleBP.PersumptiveInc44AD.GrsTrnOverBank", source: "BusinessIncome.digitalReceipts", transformation: "integer rupees" },
  { internalField: "business.cashReceipts", itrField: "ITR.ITR4.ScheduleBP.PersumptiveInc44AD.GrsTotalTrnOverInCash", source: "BusinessIncome.cashReceipts", transformation: "integer rupees" },
  { internalField: "calc.businessIncome", itrField: "ITR.ITR4.ScheduleBP.PersumptiveInc44AD.TotPersumptiveInc44AD", source: "presumptive44AD", transformation: "max(6%/8% minimum, declared)" },
  { internalField: "profession.grossReceipts", itrField: "ITR.ITR4.ScheduleBP.PersumptiveInc44ADA.GrsReceipt", source: "ProfessionalIncome.grossReceipts", transformation: "integer rupees" },
  { internalField: "calc.professionIncome", itrField: "ITR.ITR4.ScheduleBP.PersumptiveInc44ADA.TotPersumptiveInc44ADA", source: "presumptive44ADA", transformation: "max(50% minimum, declared)" },
  { internalField: "calc.salaryIncome", itrField: "ITR.ITR4.IncomeDeductions.IncomeFromSal", source: "TaxEngine", transformation: "gross - exemptions - std deduction" },
  { internalField: "calc.housePropertyIncome", itrField: "ITR.ITR4.IncomeDeductions.TotalIncomeChargeableUnHP", source: "TaxEngine", transformation: "NAV - 30% - interest" },
  { internalField: "calc.otherSources", itrField: "ITR.ITR4.IncomeDeductions.IncomeOthSrc", source: "OtherIncome", transformation: "sum" },
  { internalField: "calc.capitalGains", itrField: "ITR.ITR4.LTCG112A.LongCap112A", source: "CapitalGain 112A", transformation: "special-rate, not slab income" },
  { internalField: "calc.deductions", itrField: "ITR.ITR4.IncomeDeductions.DeductUndChapVIA.TotalChapVIADeductions", source: "Deduction eligible amounts", transformation: "regime-limited" },
  { internalField: "calc.taxBeforeRebate", itrField: "ITR.ITR4.TaxComputation.TotalTaxPayable", source: "slabs on normal-rate income", transformation: "integer" },
  { internalField: "calc.rebate", itrField: "ITR.ITR4.TaxComputation.Rebate87A", source: "s.87A AY 2026-27", transformation: "min(tax, 60000) if TI≤12L" },
  { internalField: "calc.cess", itrField: "ITR.ITR4.TaxComputation.EducationCess", source: "4% HEC", transformation: "roundTaxAmount" },
  { internalField: "calc.tds", itrField: "ITR.ITR4.TaxPaid.TaxesPaid.TDS", source: "Salary TDS + TDSEntry", transformation: "sum" },
  { internalField: "bankAccounts", itrField: "ITR.ITR4.Refund.BankAccountDtls.AddtnlBankDetails", source: "BankAccount", transformation: "mask in UI; IFSC+acct in JSON" },
];
