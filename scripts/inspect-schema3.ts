import schema from "../src/lib/itr-json/schemas/ay2026_27/itr4/schema.json";
const defs = (schema as { definitions: Record<string, any> }).definitions;

function enums(name: string, field?: string) {
  const d = defs[name];
  if (!d) return;
  if (field) {
    const p = d.properties?.[field];
    console.log(name + "." + field, JSON.stringify(p, null, 2).slice(0, 1200));
  } else {
    console.log(name, JSON.stringify({ type: d.type, enum: d.enum, required: d.required, properties: d.properties ? Object.keys(d.properties) : undefined }, null, 2).slice(0, 1500));
  }
}

enums("PersonalInfo", "EmployerCategory");
enums("PersonalInfo", "Status");
enums("PersonalInfo", "SecondaryAdd");
enums("PersonalInfo", "DOB");
enums("FilingStatus", "ReturnFileSec");
enums("FilingStatus", "Form10IEAEarlierAYOldRegime");
enums("Verification", "Declaration");
enums("Verification", "Capacity");
enums("IntrstPay", undefined);
enums("StateCode");
enums("CountryCode");
enums("NatOfBus44AD");
enums("EmployerOrDeductorOrCollectDetl");
enums("nonEmptyString");
enums("Form_ITR4", "Description");
enums("Form_ITR4", "SchemaVer");
enums("CreationInfo", "JSONCreationDate");
enums("Address", "CountryCodeMobile");
enums("Address", "MobileNo");
enums("Address", "PinCode");
enums("Address", "EmailAddress");
enums("BankDetailType", "AccountType");
enums("Refund");
enums("BankAccountDtls");
enums("ScheduleBP");
enums("FinanclPartclrOfBusiness");
enums("IncomeDeductions", "OthersInc");
enums("IncomeDeductions", "AllwncExemptUs10");
enums("LTCG112A");
