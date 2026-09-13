import type { NormalizedReturn } from "@/lib/tax/model";
import { calculateAy2026_27, type TaxComputation } from "@/lib/tax-engine/ay2026_27";
import { splitName, mobileInt, pinInt } from "@/lib/itr-json/ay2026_27/itr4/stateCodes";
import { itr3StateCodeOf } from "./stateCodes";
import { deepMerge, fillItr3Required } from "./fillRequired";
import { calculateRefundOrPayable } from "@/lib/tax-engine/ay2026_27/refund";
import { roundTaxAmount } from "@/lib/tax-engine/ay2026_27/rounding";

export const ITR3_OFFICIAL_SCHEMA_VER = "Ver1.0";
export const ITR3_SOFTWARE_ID = "SW00000001";
export const ITR3_FORM_DESCRIPTION = "For Indl and HUF having income from business or profession";

export type Itr3MapIssue = { field: string; section: string; message: string };

const n = (v: number) => Math.max(0, Math.round(Number.isFinite(v) ? v : 0));

function residential(status: NormalizedReturn["residentialStatus"]) {
  if (status === "RESIDENT") return "RES";
  if (status === "NRI") return "NRI";
  if (status === "RNOR") return "NOR";
  return "";
}

function incCyla(amount: number) {
  const v = n(amount);
  return { IncCYLA: { IncOfCurYrUnderThatHead: v, IncOfCurYrAfterSetOff: v } };
}

function incBfla(amount: number) {
  const v = n(amount);
  return {
    IncBFLA: {
      IncOfCurYrUndHeadFromCYLA: v,
      BFUnabsorbedDeprSetoff: 0,
      BFAllUs35Cl4Setoff: 0,
      IncOfCurYrAfterSetOffBFLosses: v,
    },
  };
}

function salaryBfla(amount: number) {
  const v = n(amount);
  return { IncBFLA: { IncOfCurYrUndHeadFromCYLA: v, IncOfCurYrAfterSetOffBFLosses: v } };
}

export function collectItr3MappingIssues(data: NormalizedReturn): Itr3MapIssue[] {
  const issues: Itr3MapIssue[] = [];
  const err = (field: string, section: string, message: string) => issues.push({ field, section, message });
  if (data.taxpayerType === "FIRM") {
    err("Status", "PartA_GEN1", "ITR-3 requires [PersonalInfo.Status] I or H. Firms are not in the official ITR-3 Status enum.");
  }
  if (!data.pan) err("PAN", "PartA_GEN1", "ITR-3 requires [PersonalInfo.PAN]. TaxPilot does not currently have this information.");
  if (!data.name.trim()) err("AssesseeName", "PartA_GEN1", "ITR-3 requires [PersonalInfo.AssesseeName.SurNameOrOrgName].");
  if (!data.dateOfBirth) err("DOB", "PartA_GEN1", "ITR-3 requires [PersonalInfo.DOB].");
  if (!data.addressLine1?.trim()) err("ResidenceNo", "PartA_GEN1", "ITR-3 requires [Address.ResidenceNo].");
  if (!(data.locality || data.addressLine1)?.trim()) err("LocalityOrArea", "PartA_GEN1", "ITR-3 requires [Address.LocalityOrArea].");
  if (!data.city?.trim()) err("CityOrTownOrDistrict", "PartA_GEN1", "ITR-3 requires [Address.CityOrTownOrDistrict].");
  if (!itr3StateCodeOf(data.stateCode || data.state)) {
    err("StateCode", "PartA_GEN1", "ITR-3 requires [Address.StateCode] from the official ITR-3 StateCode enum.");
  }
  if (!data.email) err("EmailAddress", "PartA_GEN1", "ITR-3 requires [Address.EmailAddress].");
  if (mobileInt(data.phone) == null) err("MobileNo", "PartA_GEN1", "ITR-3 requires [Address.MobileNo].");
  if (!residential(data.residentialStatus)) {
    err("ResidentialStatus", "FilingStatus", "ITR-3 requires [FilingStatus.ResidentialStatus]. TaxPilot does not currently have this information.");
  }
  if (!data.fatherName?.trim()) err("FatherName", "Verification", "ITR-3 requires [Verification.Declaration.FatherName].");
  if (pinInt(data.pincode) == null) err("PinCode", "PartA_GEN1", "ITR-3 requires [Address.PinCode].");
  if (!data.bankAccounts.length) {
    err("BankAccountDtls", "PartB_TTI", "ITR-3 requires [Refund.BankAccountDtls] bank details. TaxPilot does not currently have this information.");
  }
  return issues;
}

export function mapItr3Official(data: NormalizedReturn, generatedAt = new Date()) {
  const calc = calculateAy2026_27(data, generatedAt);
  const issues = collectItr3MappingIssues(data);
  const date = generatedAt.toISOString().slice(0, 10);
  const names = splitName(data.lastName ? `${data.firstName || ""} ${data.lastName}` : data.name);
  const first = (data.firstName || names.first).slice(0, 25);
  const last = (data.lastName || names.last).slice(0, 75);
  const city = (data.city || "").slice(0, 50);
  const stateCode = itr3StateCodeOf(data.stateCode || data.state) || "";
  const pin = pinInt(data.pincode);
  const mobile = mobileInt(data.phone);
  const status = data.taxpayerType === "HUF" ? "H" : "I";
  const hasBus = data.business.turnover > 0 || data.business.declaredIncome > 0 || calc.businessIncome > 0;
  const hasProf = data.profession.grossReceipts > 0 || calc.professionIncome > 0;
  const busProf = n(calc.businessIncome + calc.professionIncome);
  const salary = n(calc.salaryIncome);
  const hp = n(calc.housePropertyIncome);
  const hpLoss = calc.housePropertyIncome < 0 ? n(-calc.housePropertyIncome) : 0;
  const other = n(calc.otherSources);
  const cg = n(calc.capitalGains);
  const gti = n(calc.grossTotalIncomeIncLtcg);
  const taxable = n(calc.taxableIncome);
  const settlement = calculateRefundOrPayable({
    totalTax: calc.totalLiability ?? calc.totalTax,
    tds: calc.tds,
    tcs: calc.tcs,
    advanceTax: calc.advanceTax,
    selfAssessmentTax: calc.selfAssessmentTax,
  });
  const payable = settlement.status === "TAX_PAYABLE" ? settlement.amount : 0;
  const refund = settlement.status === "REFUND" ? settlement.amount : 0;
  const turnover = n(data.business.turnover);
  const digital = n(data.business.digitalReceipts);
  const cash = n(data.business.cashReceipts);
  const netProfit = n(data.business.declaredIncome || calc.businessIncome);
  const books = data.business.section === "BOOKS";
  const liable44AB = turnover > 10_000_000;
  const banks = data.bankAccounts.map((b) => ({
    IFSCCode: b.ifsc,
    BankName: (b.bankName || "").slice(0, 125),
    BankAccountNo: b.accountNumber,
    AccountType: (b.accountType === "CURRENT" || b.accountType === "CA" ? "CA" : "SB") as "SB" | "CA",
    UseForRefund: b.isPrimary ? ("true" as const) : ("false" as const),
  }));

  const overlay: Record<string, unknown> = {
    CreationInfo: {
      SWVersionNo: "1.0",
      SWCreatedBy: ITR3_SOFTWARE_ID,
      JSONCreatedBy: ITR3_SOFTWARE_ID,
      JSONCreationDate: date,
      IntermediaryCity: city.slice(0, 25) || "NA",
      Digest: "-",
    },
    Form_ITR3: {
      FormName: "ITR-3",
      Description: ITR3_FORM_DESCRIPTION,
      AssessmentYear: "2026",
      SchemaVer: ITR3_OFFICIAL_SCHEMA_VER,
      FormVer: ITR3_OFFICIAL_SCHEMA_VER,
    },
    PartA_GEN1: {
      PersonalInfo: {
        AssesseeName: { FirstName: first, SurNameOrOrgName: last },
        PAN: data.pan,
        Address: {
          ResidenceNo: (data.addressLine1 || "").slice(0, 50),
          LocalityOrArea: (data.locality || data.addressLine1 || "").slice(0, 50),
          CityOrTownOrDistrict: city,
          StateCode: stateCode,
          CountryCode: "91",
          ...(pin != null ? { PinCode: pin } : {}),
          CountryCodeMobile: 91,
          ...(mobile != null ? { MobileNo: mobile } : {}),
          EmailAddress: data.email || "",
        },
        SecondaryAdd: "N",
        DOB: data.dateOfBirth,
        Status: status,
      },
      FilingStatus: {
        ReturnFileSec: 11,
        IncFrmBusOrProf: hasBus || hasProf ? "Y" : "N",
        SeventhProvisio139: "N",
        ResidentialStatus: residential(data.residentialStatus),
        HeldUnlistedEqShrPrYrFlg: "N",
        ForeignExchangeFlag: "N",
        FiiFpiFlag: "N",
        ItrFilingDueDate: liable44AB ? "2026-10-31" : "2026-08-31",
        ...(data.regime === "OLD" ? { OptOldRegimeCurrAY: "Y" } : {}),
      },
    },
    PartA_GEN2: {
      AuditInfo: {
        LiableSec44AAflg: books || hasBus ? "Y" : "N",
        IncDclrdUs: data.business.section === "44AD" || data.profession.section === "44ADA" ? "Y" : "N",
        LiableSec44ABflg: liable44AB ? "Y" : "N",
        LiableSec92Eflg: "N",
        AccountAuditFlag: "N",
      },
    },
    PARTA_PL: {
      CreditsToPL: { TotCreditsToPL: n(turnover || netProfit) },
      DebitsToPL: {
        EmployeeComp: { SalsWages: 0, TotEmployeeComp: 0 },
        DepreciationAmort: 0,
        OtherExpenses: 0,
        PBT: netProfit,
      },
      TaxProvAppr: { ProfitAfterTax: netProfit, ProprietorAccBalTrf: netProfit, AmtAvlAppr: netProfit },
      NoBooksOfAccPL: {
        GrossReceipt: turnover,
        GrsRcptAccPayeeOrBankMode: digital,
        GrsRcptOtherMode: cash,
        GrossProfit: netProfit,
        Expenses: n(turnover - netProfit),
        NetProfit: netProfit,
        GrossReceiptPrf: n(data.profession.grossReceipts),
        GrsRcptAccPayeeOrBankModePrf: n(Math.max(0, data.profession.grossReceipts - data.profession.cashReceipts)),
        GrsRcptOtherModePrf: n(data.profession.cashReceipts),
        GrossProfitPrf: n(calc.professionIncome),
        ExpensesPrf: n(data.profession.grossReceipts - calc.professionIncome),
        NetProfitPrf: n(calc.professionIncome),
        TotBusinessProfession: busProf,
      },
      TurnverFrmSpecActivity: 0,
      NetIncomeFrmSpecActivity: 0,
    },
    PARTA_BS: {
      FundSrc: {
        PropFund: { PropCap: netProfit, TotPropFund: netProfit },
        TotFundSrc: netProfit,
      },
      FundApply: {
        TotFundApply: netProfit,
      },
    },
    ITR3ScheduleBP: {
      BusinessIncOthThanSpec: {
        ProfBfrTaxPL: netProfit,
        BalancePLOthThanSpecBus: netProfit,
        NetPLAftAdjBusOthThanSpec: netProfit,
        NetPLBusOthThanSpec7A7B7C: netProfit,
      },
      IncChrgUnHdProftGain: busProf,
    },
    ScheduleCYLA: {
      Salary: incCyla(salary),
      HP: incCyla(hp),
      BusProfExclSpecProf: incCyla(busProf),
      OthSrcExclRaceHorse: incCyla(other),
      STCG20Per: incCyla(0),
      STCG30Per: incCyla(0),
      STCGAppRate: incCyla(0),
      STCGDTAARate: incCyla(0),
      LTCG12_5Per: incCyla(cg),
      LTCGDTAARate: incCyla(0),
      TotalCurYr: { TotHPlossCurYr: hpLoss, TotBusLoss: 0, TotOthSrcLossNoRaceHorse: 0 },
      TotalLossSetOff: { TotHPlossCurYrSetoff: 0, TotBusLossSetoff: 0, TotOthSrcLossNoRaceHorseSetoff: 0 },
      LossRemAftSetOff: { BalHPlossCurYrAftSetoff: hpLoss, BalBusLossAftSetoff: 0, BalOthSrcLossNoRaceHorseAftSetoff: 0 },
    },
    ScheduleBFLA: {
      Salary: salaryBfla(salary),
      HP: incBfla(hp),
      BusProfExclSpecProf: incBfla(busProf),
      STCG20Per: incBfla(0),
      STCG30Per: incBfla(0),
      STCGAppRate: incBfla(0),
      STCGDTAARate: incBfla(0),
      LTCG12_5Per: incBfla(cg),
      LTCGDTAARate: incBfla(0),
      OthSrcExclRaceHorse: incBfla(other),
      TotalBFLossSetOff: { TotBFLossSetoff: 0, TotUnabsorbedDeprSetoff: 0, TotAllUs35cl4Setoff: 0 },
      IncomeOfCurrYrAftCYLABFLA: taxable,
    },
    "PartB-TI": {
      Salaries: salary,
      IncomeFromHP: hp,
      ProfBusGain: {
        ProfGainNoSpecBus: busProf,
        ProfGainSpecBus: 0,
        ProfGainSpecifiedBus: 0,
        ProfIncome115BBF: 0,
        TotProfBusGain: busProf,
      },
      CapGain: {
        ShortTerm: { ShortTerm20Per: 0, ShortTerm30Per: 0, ShortTermAppRate: 0, ShortTermSplRateDTAA: 0, TotalShortTerm: 0 },
        LongTerm: { LongTerm12_5Per: cg, LongTermSplRateDTAA: 0, TotalLongTerm: cg },
        ShortTermLongTermTotal: cg,
        CapGains30Per115BBH: 0,
        TotalCapGains: cg,
      },
      IncFromOS: {
        OtherSrcThanOwnRaceHorse: other,
        IncChargblSplRate: 0,
        FromOwnRaceHorse: 0,
        TotIncFromOS: other,
      },
      TotalTI: n(salary + hp + busProf + cg + other),
      CurrentYearLoss: hpLoss,
      BalanceAfterSetoffLosses: gti,
      BroughtFwdLossesSetoff: 0,
      GrossTotalIncome: gti,
      IncChargeTaxSplRate111A112: cg,
      DeductionsUndSchVIADtl: {
        PartBchapterVIA: n(calc.deductions),
        PartCchapterVIA: 0,
        TotDeductUndSchVIA: n(calc.deductions),
      },
      DeductionsUnder10Aor10AA: 0,
      TotalIncome: taxable,
      AggregateIncome: taxable,
      DeemedIncomeUs115JC: 0,
    },
    PartB_TTI: {
      ComputationOfTaxLiability: {
        TaxPayableOnDeemedTI: { TaxDeemedTISec115JC: 0, SurchargeOnAboveCrore: 0, EducationCess: 0, TotalTax: 0 },
        TaxPayableOnTI: {
          TaxAtNormalRatesOnAggrInc: n(calc.taxBeforeRebate),
          TaxAtSpecialRates: n(calc.taxOnSpecialRate),
          RebateOnAgriInc: 0,
          TaxPayableOnTotInc: n(calc.taxBeforeRebate),
          Rebate87A: n(calc.rebate),
          TaxPayableOnRebate: roundTaxAmount(calc.taxBeforeRebate - calc.rebate - (calc.marginalRelief || 0)),
          Surcharge25ofSI: 0,
          SurchargeOnAboveCrore: n(calc.surcharge),
          Surcharge25ofSIBeforeMarginal: 0,
          SurchargeOnAboveCroreBeforeMarginal: n(calc.surcharge),
          TotalSurcharge: n(calc.surcharge),
          EducationCess: n(calc.cess),
          GrossTaxLiability: n(calc.totalTax),
        },
        GrossTaxPayable: n(calc.totalTax),
        CreditUS115JD: 0,
        TaxPayAfterCreditUs115JD: n(calc.totalTax),
        NetTaxLiability: n(calc.totalTax),
        IntrstPay: {
          IntrstPayUs234A: n(calc.interest234A),
          IntrstPayUs234B: n(calc.interest234B),
          IntrstPayUs234C: n(calc.interest234C),
          LateFilingFee234F: n(calc.fee234F),
        },
        AggregateTaxInterestLiability: n(calc.totalLiability ?? calc.totalTax),
      },
      TaxPaid: {
        TaxesPaid: {
          AdvanceTax: n(calc.advanceTax),
          TDS: n(calc.tds),
          TCS: n(calc.tcs),
          SelfAssessmentTax: n(calc.selfAssessmentTax),
          TotalTaxesPaid: n(calc.prepaid),
        },
        BalTaxPayable: payable,
      },
      Refund: {
        RefundDue: refund,
        BankAccountDtls: {
          BankDtlsFlag: banks.length ? "Y" : "N",
          AddtnlBankDetails: banks.length ? banks : undefined,
        },
      },
      AssetOutIndiaFlag: "NO",
    },
    Verification: {
      Declaration: {
        AssesseeVerName: data.name.slice(0, 125),
        FatherName: (data.fatherName || "").slice(0, 125),
        AssesseeVerPAN: data.pan,
      },
      Capacity: status === "H" ? "K" : "S",
      Date: date,
      Place: (data.verificationPlace || data.city || "").slice(0, 50),
    },
  };

  if (salary > 0) {
    overlay.ScheduleS = {
      TotalGrossSalary: n(data.salary.gross),
      AllwncExtentExemptUs10: n(data.salary.exemptions),
      NetSalary: n(Math.max(0, data.salary.gross - data.salary.exemptions)),
      DeductionUS16: n(calc.standardDeduction),
      DeductionUnderSection16ia: n(calc.standardDeduction),
      EntertainmntalwncUs16ii: 0,
      ProfessionalTaxUs16iii: 0,
      TotIncUnderHeadSalaries: salary,
    };
  }
  if (data.salary.tds > 0 && data.salary.employerTan) {
    overlay.ScheduleTDS1 = {
      TDSonSalary: [
        {
          EmployerOrDeductorOrCollectDetl: {
            TAN: data.salary.employerTan,
            EmployerOrDeductorOrCollecterName: (data.salary.employerName || "").slice(0, 75),
          },
          IncChrgSal: n(data.salary.gross),
          TotalTDSSal: n(data.salary.tds),
        },
      ],
      TotalTDSonSalaries: n(data.salary.tds),
    };
  }

  const itr3 = deepMerge(fillItr3Required(), overlay);
  return { json: { ITR: { ITR3: itr3 } }, calc, issues };
}

export function mapItr3FieldPath() {
  return {
    pan: "ITR.ITR3.PartA_GEN1.PersonalInfo.PAN",
    salary: "ITR.ITR3.PartB-TI.Salaries",
    businessIncome: "ITR.ITR3.PartB-TI.ProfBusGain.ProfGainNoSpecBus",
    netProfit: "ITR.ITR3.PARTA_PL.NoBooksOfAccPL.NetProfit",
    turnover: "ITR.ITR3.PARTA_PL.NoBooksOfAccPL.GrossReceipt",
    otherSources: "ITR.ITR3.PartB-TI.IncFromOS.TotIncFromOS",
    houseProperty: "ITR.ITR3.PartB-TI.IncomeFromHP",
    capitalGains: "ITR.ITR3.PartB-TI.CapGain.TotalCapGains",
    tds: "ITR.ITR3.PartB_TTI.TaxPaid.TaxesPaid.TDS",
    totalIncome: "ITR.ITR3.PartB-TI.TotalIncome",
  } as const;
}

export type { TaxComputation };
