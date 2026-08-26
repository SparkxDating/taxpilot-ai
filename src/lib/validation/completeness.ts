import type { NormalizedReturn } from "@/lib/tax/model";
import type { BusinessIssue } from "./businessRules";
import { isCodeAD, isCodeADA } from "@/lib/itr-json/ay2026_27/itr4/natureCodes";

const panRe = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const ifscRe = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const dobRe = /^\d{4}-\d{2}-\d{2}$/;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function completenessValidate(data: NormalizedReturn, returnId = "new"): BusinessIssue[] {
  const id = returnId;
  const issues: BusinessIssue[] = [];
  const err = (field: string, message: string, explanation: string, route = "profile") => {
    issues.push({
      id: `ITR4_REQ_${field.toUpperCase()}`,
      severity: "ERROR",
      field,
      section: route === "tds" ? "Bank details" : route === "income" ? "Income" : "Personal information",
      message,
      explanation,
      fixRoute: `/returns/${id}/${route}`,
    });
  };

  if (!data.name.trim()) err("name", "Name is required.", "Enter the name as per PAN.");
  if (!panRe.test(data.pan)) err("pan", "PAN is missing or invalid.", "Enter PAN in AAAAA9999A format.");
  if (!data.dateOfBirth || !dobRe.test(data.dateOfBirth)) {
    err("dateOfBirth", "Missing Date of Birth", "Enter Date of Birth in YYYY-MM-DD. TaxPilot will not invent a date.");
  } else {
    const [y, m, d] = data.dateOfBirth.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
      err("dateOfBirth", "Date of Birth is not a valid calendar date.", "Correct the date. TaxPilot will not substitute a default.");
    }
  }
  if (!data.fatherName?.trim()) err("fatherName", "Father's name is required for verification.", "Official Verification.Declaration.FatherName cannot be fabricated.");
  if (!data.email || !emailRe.test(data.email)) err("email", "A valid email is required.", "The official schema requires EmailAddress.");
  const digits = (data.phone || "").replace(/\D/g, "");
  if (digits.length < 10) err("phone", "A 10-digit mobile number is required.", "The official schema requires MobileNo.");
  if (!data.addressLine1?.trim()) err("addressLine1", "Address is required.", "ResidenceNo cannot be invented.");
  if (!data.city?.trim()) err("city", "City is required.", "CityOrTownOrDistrict cannot be invented.");
  if (!data.state?.trim() && !data.stateCode) err("state", "State is required.", "StateCode cannot be defaulted to 99 unless you select Other.");
  const pin = Number((data.pincode || "").replace(/\D/g, "").slice(0, 6));
  if (!(pin >= 100000 && pin <= 999999)) err("pincode", "PIN code is required.", "A 6-digit PIN is required. TaxPilot will not substitute a city PIN.");
  if (!data.residentialStatus) err("residentialStatus", "Residential status is required.", "ITR-4 is only for residents.");
  if (!data.verificationPlace?.trim() && !data.city?.trim()) {
    err("verificationPlace", "Verification place is required.", "Enter the place of verification.");
  }
  if (!data.bankAccounts.length) {
    err("bankAccounts", "At least one bank account is required.", "Refund bank details are required by the official schema.", "tds");
  }
  for (const b of data.bankAccounts) {
    if (!ifscRe.test(b.ifsc)) err("ifsc", "IFSC is invalid.", "Enter an 11-character IFSC.", "tds");
    if (!b.accountNumber) err("accountNumber", "Bank account number is required.", "Do not use a test account number.", "tds");
    if (!b.bankName?.trim()) err("bankName", "Bank name is required.", "The official schema requires BankName.", "tds");
  }
  const hasBiz = data.business.turnover > 0 || data.business.digitalReceipts > 0 || data.business.cashReceipts > 0;
  if (hasBiz && !data.business.nature.trim()) err("nature", "Nature of business is required.", "Do not default a NIC code or description.", "income");
  if (hasBiz && !data.business.natureCode) err("natureCode", "Business code (CodeAD) is required.", "Select the official NatOfBus44AD code. TaxPilot will not guess 09027.", "income");
  if (hasBiz && data.business.natureCode && !isCodeAD(data.business.natureCode)) {
    err("natureCode", "Business code is not an official NatOfBus44AD value.", "Choose a code from the official ITR-4 schema enum.", "income");
  }
  const hasProf = data.profession.grossReceipts > 0;
  if (hasProf && !data.profession.profession.trim()) err("profession", "Profession description is required.", "Do not invent a profession name.", "income");
  if (hasProf && !data.profession.natureCode) err("professionCode", "Profession code (CodeADA) is required.", "Select the official NatOfBus44ADA code.", "income");
  if (hasProf && data.profession.natureCode && !isCodeADA(data.profession.natureCode)) {
    err("professionCode", "Profession code is not an official NatOfBus44ADA value.", "Choose a code from the official ITR-4 schema enum.", "income");
  }
  if (data.salary.tds > 0 && !data.salary.employerTan) err("employerTan", "Employer TAN is required when salary TDS is claimed.", "TAN cannot be invented.", "income");
  if (data.salary.tds > 0 && !data.salary.employerName.trim()) err("employerName", "Employer name is required when salary TDS is claimed.", "Do not use a placeholder employer name.", "income");
  return issues;
}
