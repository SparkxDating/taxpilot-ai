import { prisma } from "@/lib/db";
import { recomputeReturn } from "@/lib/tax/persist";
import {
  importedEntry,
  parsePreparation,
  pickAuthoritativeFacts,
  shouldOverwriteFromVerified,
  type PreparationState,
} from "./prefill";
import { parseAmount } from "./rupees";

/** Apply VERIFIED TaxFacts only. Never called from extractors. Never writes ITR JSON. */
export async function applyVerifiedFactsToTaxModel(returnId: string) {
  const ret = await prisma.taxReturn.findUnique({ where: { id: returnId } });
  if (!ret) return;
  const prep = parsePreparation(ret.preparationJson);
  const open = await prisma.documentConflict.findMany({ where: { returnId, status: "OPEN" } });
  const openGroups = new Set(open.map((c) => c.field));
  const all = await prisma.taxFact.findMany({ where: { returnId } });
  const facts = pickAuthoritativeFacts(all, openGroups);
  const factAt = (path: string) => facts.find((f) => f.normalizedTaxField === path);
  const num = (path: string) => (shouldOverwriteFromVerified(prep.fields[path]) ? factAt(path)?.numericValue ?? null : null);
  const str = (path: string) => (shouldOverwriteFromVerified(prep.fields[path]) ? factAt(path)?.value || "" : "");

  const manuals = await prisma.documentConflict.findMany({
    where: { returnId, status: "RESOLVED", resolution: "MANUAL_VALUE" },
  });
  const manualNum = (group: string) => {
    const row = manuals.find((c) => c.field === group);
    return row ? parseAmount(row.resolvedValue) : null;
  };

  const gross = openGroups.has("SALARY") ? null : (manualNum("SALARY") ?? num("salary.grossSalary"));
  const tds = openGroups.has("TDS") ? null : (manualNum("TDS") ?? num("salary.tds"));
  const employerName = str("salary.employerName");
  const employerTan = str("salary.employerTan");
  const exemptions = num("salary.exemptions");
  const standardDeduction = num("salary.standardDeduction");

  if (gross != null || tds != null || employerName || employerTan) {
    const existing = await prisma.salaryIncome.findFirst({ where: { returnId } });
    await prisma.salaryIncome.deleteMany({ where: { returnId } });
    await prisma.salaryIncome.create({
      data: {
        returnId,
        grossSalary: gross ?? existing?.grossSalary ?? 0,
        tds: tds ?? existing?.tds ?? 0,
        employerName: employerName || existing?.employerName || "",
        employerTan: employerTan || existing?.employerTan || "",
        exemptions: exemptions ?? existing?.exemptions ?? 0,
        standardDeduction: standardDeduction ?? existing?.standardDeduction ?? 0,
      },
    });
  }

  const interest = openGroups.has("INTEREST") ? null : (manualNum("INTEREST") ?? num("income.interest"));
  if (interest != null && interest > 0) {
    await prisma.otherIncome.deleteMany({ where: { returnId, kind: "Interest" } });
    await prisma.otherIncome.create({
      data: { returnId, kind: "Interest", amount: interest, source: "AIS (verified)" },
    });
  }

  const dividend = openGroups.has("DIVIDEND") ? null : (manualNum("DIVIDEND") ?? num("income.dividend"));
  if (dividend != null && dividend > 0) {
    await prisma.otherIncome.deleteMany({ where: { returnId, kind: "Dividend" } });
    await prisma.otherIncome.create({
      data: { returnId, kind: "Dividend", amount: dividend, source: "AIS (verified)" },
    });
  }

  const receipts = await prisma.bankTransaction.findMany({
    where: { returnId, verifiedCategory: "BUSINESS_RECEIPT" },
  });
  const receiptTotal = receipts.reduce((s, t) => s + t.credit, 0);
  if (receiptTotal > 0 && shouldOverwriteFromVerified(prep.fields["business.receipts"])) {
    const existing = await prisma.businessIncome.findFirst({ where: { returnId } });
    if (existing) {
      await prisma.businessIncome.update({
        where: { id: existing.id },
        data: { digitalReceipts: receiptTotal },
      });
    } else {
      await prisma.businessIncome.create({
        data: { returnId, digitalReceipts: receiptTotal, turnover: receiptTotal, section: "44AD" },
      });
    }
  }

  const next: PreparationState = { fields: { ...prep.fields } };
  const stamp = (path: string, value: string | number | null | undefined) => {
    const fact = factAt(path);
    if (!fact || !shouldOverwriteFromVerified(next.fields[path]) || value == null || value === "") return;
    next.fields[path] = importedEntry(fact, String(value));
  };
  stamp("salary.grossSalary", gross);
  stamp("salary.tds", tds);
  stamp("salary.employerName", employerName);
  stamp("salary.employerTan", employerTan);
  stamp("salary.exemptions", exemptions);
  stamp("salary.standardDeduction", standardDeduction);
  stamp("income.interest", interest);
  stamp("income.dividend", dividend);
  if (receiptTotal > 0) {
    next.fields["business.receipts"] = {
      origin: "IMPORTED",
      source: "BANK_STATEMENT",
      sourceDocumentId: receipts[0]?.documentId || "",
      sourcePage: null,
      originalValue: String(receiptTotal),
      currentValue: String(receiptTotal),
      factId: "",
    };
  }
  await prisma.taxReturn.update({ where: { id: returnId }, data: { preparationJson: JSON.stringify(next) } });
  await recomputeReturn(returnId);
}
