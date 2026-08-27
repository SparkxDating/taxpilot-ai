import { describe, expect, it } from "vitest";
import {
  aisTransactionsFromRows,
  bankRowsFromRecords,
  encodeAisTxn,
  reconstructCachedResult,
} from "@/lib/documents/persistExtraction";
import type { AisTransaction, BankRow } from "@/lib/documents/types";

const aisTxns: AisTransaction[] = [
  {
    date: "01-04-2025",
    description: "Interest from SBI",
    amount: 12_000,
    reportedValue: 12_000,
    source: "AIS",
    category: "INTEREST",
    originalCategory: "Interest from SBI",
    sourcePage: 2,
    sourceText: "01-04-2025 Interest from SBI 12,000",
  },
  {
    date: "02-04-2025",
    description: "Dividend payout",
    amount: 5_000,
    reportedValue: 5_000,
    source: "AIS",
    category: "DIVIDEND",
    originalCategory: "Dividend payout",
    sourcePage: 2,
    sourceText: "02-04-2025 Dividend payout 5,000",
  },
];

const bankTxns: BankRow[] = [
  {
    date: "2025-04-01",
    description: "Customer receipt INV-9",
    debit: 0,
    credit: 25_000,
    balance: 35_000,
    reference: "UTR1",
    sourcePage: null,
    rawCategory: "UNKNOWN",
    suggestedCategory: "BUSINESS_RECEIPT",
    verifiedCategory: null,
  },
];

describe("Phase 4.1 extraction cache transactions", () => {
  it("restores AIS transactions from cached DocumentExtraction rows", () => {
    const rows = aisTxns.map((tx, i) => ({
      fieldKey: `txn.${i}`,
      extractedValue: String(tx.amount),
      numericValue: tx.amount,
      confidence: 0.7,
      pageRef: tx.sourcePage == null ? "" : String(tx.sourcePage),
      sourceText: encodeAisTxn(tx),
      extractionMethod: "DETERMINISTIC",
    }));
    const restored = reconstructCachedResult({
      kind: "AIS",
      extractions: [
        {
          fieldKey: "interest",
          extractedValue: "12000",
          numericValue: 12_000,
          confidence: 0.88,
          pageRef: "2",
          sourceText: "Interest: 12,000",
          extractionMethod: "DETERMINISTIC",
        },
        ...rows,
      ],
      bankTx: [],
    });
    expect(restored.cached).toBe(true);
    expect(restored.aisTransactions).toEqual(aisTxns);
    expect(restored.aisTransactions).not.toEqual([]);
    expect(restored.fields.find((f) => f.field === "interest")?.numericValue).toBe(12_000);
  });

  it("restores bank transactions from cached BankTransaction rows", () => {
    const restored = reconstructCachedResult({
      kind: "BANK_STATEMENT",
      extractions: [],
      bankTx: bankTxns.map((tx) => ({
        date: tx.date,
        description: tx.description,
        debit: tx.debit,
        credit: tx.credit,
        balance: tx.balance,
        reference: tx.reference,
        sourcePage: "",
        rawCategory: tx.rawCategory,
        suggestedCategory: tx.suggestedCategory,
        verifiedCategory: "",
      })),
    });
    expect(restored.transactions).toEqual(bankTxns);
    expect(restored.transactions).not.toEqual([]);
  });

  it("fresh and cached transaction data are equivalent and remain unverified", () => {
    const encoded = aisTxns.map((tx, i) => ({
      fieldKey: `txn.${i}`,
      extractedValue: String(tx.amount),
      numericValue: tx.amount,
      confidence: 0.7,
      pageRef: "2",
      sourceText: encodeAisTxn(tx),
      extractionMethod: "DETERMINISTIC",
    }));
    expect(aisTransactionsFromRows(encoded)).toEqual(aisTxns);
    const bankStored = bankTxns.map((tx) => ({
      ...tx,
      sourcePage: "",
      verifiedCategory: "",
    }));
    expect(bankRowsFromRecords(bankStored)).toEqual(bankTxns);
    expect(bankRowsFromRecords(bankStored)[0].verifiedCategory).toBeNull();
  });
});
