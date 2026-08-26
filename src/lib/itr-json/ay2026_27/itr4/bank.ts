export type OfficialBank = {
  IFSCCode: string;
  BankName: string;
  BankAccountNo: string;
  AccountType: "SB" | "CA" | "CC" | "OD" | "NRO" | "OTH";
  UseForRefund: "true" | "false";
};
