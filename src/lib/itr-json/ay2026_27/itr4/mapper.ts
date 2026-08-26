import type { NormalizedReturn } from "@/lib/tax/model";
import { calculateAy2026_27, type TaxComputation } from "@/lib/tax-engine/ay2026_27";
import { chapVia } from "./chapVia";
import { splitName, stateCodeOf, mobileInt, pinInt } from "./stateCodes";
import { roundTaxAmount } from "@/lib/tax-engine/ay2026_27/rounding";

export const OFFICIAL_SCHEMA_VER = "Ver1.0";
export const SOFTWARE_ID = "SW00000001";

function emptyIntrst() {
  return { IntrstPayUs234A: 0, IntrstPayUs234B: 0, IntrstPayUs234C: 0, LateFilingFee234F: 0 };
}

function othSrcNature(kind: string) {
  const k = kind.toLowerCase();
  if (k.includes("saving")) return "SAV";
  if (k.includes("dividend")) return "DIV";
  if (k.includes("family")) return "FAP";
  if (k.includes("refund")) return "TAX";
  if (k.includes("interest") || k.includes("deposit")) return "IFD";
  return "OTH";
}

export function mapItr4Official(data: NormalizedReturn, generatedAt = new Date()) {
  const calc = calculateAy2026_27(data);
  const date = generatedAt.toISOString().slice(0, 10);
  const names = splitName(data.lastName ? `${data.firstName || ""} ${data.lastName}` : data.name);
  const first = (data.firstName || names.first).slice(0, 25);
  const last = (data.lastName || names.last).slice(0, 75);
  const via = chapVia(calc);
  const status = data.taxpayerType === "HUF" ? "H" : data.taxpayerType === "FIRM" ? "F" : "I";
  const employerCat = data.salary.gross > 0 ? data.employerCategory || "OTH" : "NA";
  const city = data.city || "Bengaluru";
  const email = data.email || "noreply@taxpilot.local";
  const payable = Math.max(0, -calc.refundOrPayable);
  const refund = Math.max(0, calc.refundOrPayable);

  const personal = {
    AssesseeName: { FirstName: first, SurNameOrOrgName: last },
    PAN: data.pan,
    Address: {
      ResidenceNo: (data.addressLine1 || "NA").slice(0, 50),
      LocalityOrArea: (data.locality || data.addressLine1 || "NA").slice(0, 50),
      CityOrTownOrDistrict: city.slice(0, 50),
      StateCode: stateCodeOf(data.stateCode || data.state),
      CountryCode: "91",
      PinCode: pinInt(data.pincode),
      CountryCodeMobile: 91,
      MobileNo: mobileInt(data.phone),
      EmailAddress: email,
    },
    SecondaryAdd: "N",
    DOB: data.dateOfBirth && /^\d{4}-\d{2}-\d{2}$/.test(data.dateOfBirth) ? data.dateOfBirth : "1990-01-15",
    EmployerCategory: employerCat,
    Status: status,
  };

  const filing = {
    ReturnFileSec: 11,
    Form10IEAEarlierAYOldRegime: data.regime === "OLD" ? "Y" : "NA",
    AsseseeRepFlg: "N" as const,
    ItrFilingDueDate: "2026-08-31",
  };

  const others =
    data.otherIncome.length > 0
      ? {
          OthersIncDtlsOthSrc: data.otherIncome.map((o) => {
            const nature = othSrcNature(o.kind);
            const row: Record<string, unknown> = { OthSrcNatureDesc: nature, OthSrcOthAmount: o.amount };
            if (nature === "OTH") row.OthSrcOthNatOfInc = (o.source || "Other").slice(0, 125);
            return row;
          }),
        }
      : undefined;

  const incomeDeductions: Record<string, unknown> = {
    IncomeFromBusinessProf: calc.businessIncome + calc.professionIncome,
    GrossSalary: data.salary.gross,
    NetSalary: Math.max(0, data.salary.gross - data.salary.exemptions),
    DeductionUs16: calc.standardDeduction,
    DeductionUs16ia: calc.standardDeduction,
    IncomeFromSal: calc.salaryIncome,
    TotalIncomeChargeableUnHP: calc.housePropertyIncome,
    IncomeOthSrc: calc.otherSources,
    GrossTotIncome: calc.grossTotalIncome,
    GrossTotIncomeIncLTCG112A: calc.grossTotalIncomeIncLtcg,
    UsrDeductUndChapVIA: via,
    DeductUndChapVIA: via,
    TotalIncome: calc.taxableIncome,
  };
  if (others) incomeDeductions.OthersInc = others;

  const taxComputation = {
    TotalTaxPayable: calc.taxBeforeRebate,
    Rebate87A: calc.rebate,
    TaxPayableOnRebate: roundTaxAmount(calc.taxBeforeRebate - calc.rebate - calc.marginalRelief),
    EducationCess: calc.cess,
    GrossTaxLiability: calc.totalTax,
    NetTaxLiability: calc.totalTax,
    IntrstPay: emptyIntrst(),
    TotTaxPlusIntrstPay: calc.totalTax,
  };

  const taxPaid = {
    TaxesPaid: {
      AdvanceTax: calc.advanceTax,
      TDS: calc.tds,
      TCS: calc.tcs,
      SelfAssessmentTax: calc.selfAssessmentTax,
      TotalTaxesPaid: calc.prepaid,
    },
    BalTaxPayable: payable,
  };

  const banks = data.bankAccounts.map((b) => ({
    IFSCCode: b.ifsc,
    BankName: (b.bankName || "BANK").slice(0, 125),
    BankAccountNo: b.accountNumber,
    AccountType: (b.accountType === "CURRENT" ? "CA" : "SB") as "SB" | "CA",
    UseForRefund: b.isPrimary ? ("true" as const) : ("false" as const),
  }));

  const refundBlock = {
    RefundDue: refund,
    BankAccountDtls: { AddtnlBankDetails: banks.length ? banks : undefined },
  };

  const verification = {
    Declaration: {
      AssesseeVerName: data.name.slice(0, 125),
      FatherName: (data.fatherName || data.name).slice(0, 125),
      AssesseeVerPAN: data.pan,
    },
    Capacity: status === "H" ? "K" : status === "F" ? "P" : "S",
    Place: (data.verificationPlace || city).slice(0, 50),
  };

  const itr4: Record<string, unknown> = {
    CreationInfo: {
      SWVersionNo: "1.0",
      SWCreatedBy: SOFTWARE_ID,
      JSONCreatedBy: SOFTWARE_ID,
      JSONCreationDate: date,
      IntermediaryCity: city.slice(0, 25),
      Digest: "-",
    },
    Form_ITR4: {
      FormName: "ITR-4",
      Description: "For Indl, HUF, Firms (other than LLP) having Presumptive Income",
      AssessmentYear: "2026",
      SchemaVer: OFFICIAL_SCHEMA_VER,
      FormVer: OFFICIAL_SCHEMA_VER,
    },
    PersonalInfo: personal,
    FilingStatus: filing,
    IncomeDeductions: incomeDeductions,
    TaxComputation: taxComputation,
    TaxPaid: taxPaid,
    Refund: refundBlock,
    Verification: verification,
  };

  if (adOrAda(data)) {
    itr4.ScheduleBP = scheduleBp(data, calc);
  }
  if (calc.capitalGains > 0) {
    itr4.LTCG112A = {
      TotSaleCnsdrn: calc.capitalGainsDetail.saleConsideration,
      TotCstAcqisn: calc.capitalGainsDetail.costOfAcquisition,
      LongCap112A: calc.capitalGains,
    };
  }
  if (data.salary.tds > 0 && isLikelyTan(data.salary.employerTan)) {
    itr4.TDSonSalaries = {
      TDSonSalary: [
        {
          EmployerOrDeductorOrCollectDetl: {
            TAN: data.salary.employerTan,
            EmployerOrDeductorOrCollecterName: (data.salary.employerName || "EMPLOYER").slice(0, 75),
          },
          IncChrgSal: data.salary.gross,
          TotalTDSSal: data.salary.tds,
        },
      ],
      TotalTDSonSalaries: data.salary.tds,
    };
  }
  const otherTds = data.tds.filter((t) => t.kind !== "TCS" && t.amount > 0);
  if (otherTds.length) {
    itr4.TDSonOthThanSals = {
      TDSonOthThanSalDtls: otherTds.map((t) => ({
        TANOfDeductor: t.tan,
        TDSClaimed: t.amount,
        TDSCreditCarriedFwd: 0,
        TDSSection: mapTdsSection(t.sectionCode),
        GrossAmount: t.grossAmount || t.amount,
      })),
      TotalTDSonOthThanSals: otherTds.reduce((s, t) => s + t.amount, 0),
    };
  }

  return { json: { ITR: { ITR4: itr4 } }, calc };
}

function adOrAda(data: NormalizedReturn) {
  return data.business.turnover > 0 || data.business.digitalReceipts > 0 || data.profession.grossReceipts > 0;
}

function scheduleBp(data: NormalizedReturn, calc: TaxComputation) {
  const bp: Record<string, unknown> = {};
  if (calc.presumptive.ad) {
    const ad = calc.presumptive.ad;
    bp.NatOfBus44AD = [
      {
        NameOfBusiness: (data.business.nature || "Business").slice(0, 75),
        CodeAD: data.business.natureCode || "09027",
      },
    ];
    bp.PersumptiveInc44AD = {
      GrsTotalTrnOver: ad.total,
      GrsTrnOverBank: data.business.digitalReceipts,
      GrsTotalTrnOverInCash: data.business.cashReceipts,
      PersumptiveInc44AD6Per: Math.round(data.business.digitalReceipts * 0.06),
      PersumptiveInc44AD8Per: Math.round(data.business.cashReceipts * 0.08),
      TotPersumptiveInc44AD: ad.income,
    };
  }
  if (calc.presumptive.ada) {
    const ada = calc.presumptive.ada;
    bp.NatOfBus44ADA = [
      {
        NameOfBusiness: (data.profession.profession || "Profession").slice(0, 75),
        CodeADA: data.profession.natureCode || "16005",
      },
    ];
    bp.PersumptiveInc44ADA = {
      GrsReceipt: ada.total,
      GrsTrnOverBank44ADA: Math.max(0, data.profession.grossReceipts - data.profession.cashReceipts),
      GrsTotalTrnOverInCash44ADA: data.profession.cashReceipts,
      TotPersumptiveInc44ADA: ada.income,
    };
  }
  return bp;
}

function isLikelyTan(tan: string) {
  return /^[A-Z]{4}[0-9]{5}[A-Z]$/.test(tan);
}

function mapTdsSection(code: string) {
  const c = code.replace(/^0/, "").toUpperCase();
  if (c === "194A" || c === "94A") return "94A";
  if (c === "194" || c === "194N") return "194";
  return "94A";
}
