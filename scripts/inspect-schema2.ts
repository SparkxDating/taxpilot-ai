import schema from "../src/lib/itr-json/schemas/ay2026_27/itr4/schema.json";

const s = schema as { definitions: Record<string, any> };
const defs = s.definitions;

function dump(name: string) {
  const d = defs[name];
  if (!d) return console.log("MISSING", name);
  console.log("\n====", name, "====");
  console.log("required", d.required);
  console.log("minProperties", d.minProperties);
  if (d.properties) {
    for (const [k, v] of Object.entries(d.properties as Record<string, any>)) {
      const t = v.type || v.$ref || (v.enum ? "enum " + JSON.stringify(v.enum).slice(0, 80) : JSON.stringify(v).slice(0, 80));
      console.log(" ", k, t);
    }
  }
}

[
  "ITR",
  "ITR4",
  "CreationInfo",
  "Form_ITR4",
  "AssesseeName",
  "PersonalInfo",
  "Address",
  "FilingStatus",
  "IncomeDeductions",
  "TaxComputation",
  "TaxPaid",
  "TaxesPaid",
  "Refund",
  "BankAccountDtls",
  "BankDetailType",
  "ScheduleBP",
  "PersumptiveInc44AD",
  "PersumptiveInc44ADA",
  "Verification",
  "LTCG112A",
  "TDSonSalaries",
  "TDSonSalary",
  "TDSonOthThanSals",
  "TDSonOthThanSalDtls",
  "ScheduleIT",
  "TaxPayment",
  "UsrDeductUndChapVIAType",
  "DeductUndChapVIAType",
  "ScheduleTCS",
].forEach(dump);
