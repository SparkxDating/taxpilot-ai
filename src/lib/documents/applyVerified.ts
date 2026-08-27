import { prisma } from "@/lib/db";
import { recomputeReturn } from "@/lib/tax/persist";
import { canEnterTaxModel, conflictGroup } from "./mapping";
import { parseAmount } from "./rupees";

/** Apply VERIFIED TaxFacts only. Never called from extractors. Never writes ITR JSON. */
export async function applyVerifiedFactsToTaxModel(returnId: string) {
  const open = await prisma.documentConflict.findMany({ where: { returnId, status: "OPEN" } });
  const openGroups = new Set(open.map((c) => c.field));
  const all = await prisma.taxFact.findMany({ where: { returnId } });
  const facts = all.filter(
    (f) =>
      canEnterTaxModel(f.status, f.verified) &&
      f.normalizedTaxField &&
      !openGroups.has(conflictGroup(f.normalizedTaxField)),
  );
  const num = (path: string) => facts.find((f) => f.normalizedTaxField === path)?.numericValue ?? null;
  const str = (path: string) => facts.find((f) => f.normalizedTaxField === path)?.value || "";

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
  if (receiptTotal > 0) {
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

  await recomputeReturn(returnId);
}
