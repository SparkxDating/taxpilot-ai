import schema from "../src/lib/itr-json/schemas/ay2026_27/itr4/schema.json";
const item = (schema as any).definitions.IncomeDeductions.properties.OthersInc.properties.OthersIncDtlsOthSrc.items;
console.log(JSON.stringify(item, null, 2).slice(0, 2500));
const salary = (schema as any).definitions.IncomeDeductions.properties;
console.log("GrossSalary min", JSON.stringify(salary.GrossSalary));
console.log("DeductionUs16ia", JSON.stringify(salary.DeductionUs16ia));
console.log("TDSonOthThanSalDtls TDSSection enum includes 94A?", (schema as any).definitions.TDSonOthThanSalDtls.properties.TDSSection.enum.includes("94A"));
console.log("TAN pattern", (schema as any).definitions.EmployerOrDeductorOrCollectDetl.properties.TAN);
console.log("Bank minItems", (schema as any).definitions.BankAccountDtls.properties.AddtnlBankDetails);
