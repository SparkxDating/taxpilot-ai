export type TaxRegime = "NEW" | "OLD";

export type NormalizedReturn = {
  assessmentYear: string;
  itrType: "ITR-4" | "ITR-3" | "UNDETERMINED";
  taxpayerType: "INDIVIDUAL" | "HUF" | "FIRM";
  residentialStatus: "RESIDENT" | "RNOR" | "NRI";
  pan: string;
  name: string;
  dateOfBirth?: string;
  regime: TaxRegime;
  salary: {
    gross: number;
    exemptions: number;
    tds: number;
    employerName: string;
    employerTan: string;
  };
  business: {
    section: "44AD" | "44AE" | "BOOKS";
    turnover: number;
    digitalReceipts: number;
    cashReceipts: number;
    declaredIncome: number;
    nature: string;
  };
  profession: {
    section: "44ADA" | "BOOKS";
    grossReceipts: number;
    cashReceipts: number;
    declaredIncome: number;
    profession: string;
  };
  houseProperties: Array<{
    occupancy: "SELF_OCCUPIED" | "LET_OUT";
    annualLetableValue: number;
    municipalTaxes: number;
    interestOnLoan: number;
  }>;
  otherIncome: Array<{ kind: string; amount: number; source: string }>;
  capitalGains: Array<{ kind: string; section: string; amount: number }>;
  deductions: Array<{ section: string; amount: number }>;
  tds: Array<{ sectionCode: string; tan: string; amount: number; deductorName: string }>;
  taxPayments: Array<{ kind: "ADVANCE" | "SELF_ASSESSMENT" | "REGULAR"; amount: number }>;
  bankAccounts: Array<{ ifsc: string; accountNumber: string; isPrimary: boolean }>;
};
