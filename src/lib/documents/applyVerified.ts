import { prisma } from "@/lib/db";
import { recomputeReturn } from "@/lib/tax/persist";
import { applyVerifiedFactsToState, parsePreparation, shouldOverwriteFromVerified } from "./prefill";

/** Apply VERIFIED TaxFacts only. Never called from extractors. Never writes ITR JSON. Never overwrites TaxFacts. */
export async function applyVerifiedFactsToTaxModel(returnId: string) {
  const ret = await prisma.taxReturn.findUnique({ where: { id: returnId } });
  if (!ret) return;
  const prep = parsePreparation(ret.preparationJson);
  const open = await prisma.documentConflict.findMany({ where: { returnId, status: "OPEN" } });
  const openGroups = new Set(open.map((c) => c.field));
  const all = await prisma.taxFact.findMany({ where: { returnId } });
  const manuals = await prisma.documentConflict.findMany({
    where: { returnId, status: "RESOLVED", resolution: "MANUAL_VALUE" },
  });
  const existingSalary = await prisma.salaryIncome.findFirst({ where: { returnId } });
  const existingInterest = await prisma.otherIncome.findFirst({ where: { returnId, kind: "Interest" } });
  const existingDividend = await prisma.otherIncome.findFirst({ where: { returnId, kind: "Dividend" } });
  const existingBusiness = await prisma.businessIncome.findFirst({ where: { returnId } });
  const receipts = await prisma.bankTransaction.findMany({
    where: { returnId, verifiedCategory: "BUSINESS_RECEIPT" },
  });
  const receiptTotal = receipts.reduce((s, t) => s + t.credit, 0);

  const state = applyVerifiedFactsToState({
    prep,
    facts: all,
    openGroups,
    manuals: manuals.map((m) => ({ field: m.field, resolvedValue: m.resolvedValue })),
    existingSalary: existingSalary
      ? {
          grossSalary: existingSalary.grossSalary,
          tds: existingSalary.tds,
          employerName: existingSalary.employerName,
          employerTan: existingSalary.employerTan,
          exemptions: existingSalary.exemptions,
          standardDeduction: existingSalary.standardDeduction,
        }
      : null,
    existingInterest: existingInterest ? { amount: existingInterest.amount, source: existingInterest.source } : null,
    existingDividend: existingDividend ? { amount: existingDividend.amount, source: existingDividend.source } : null,
    existingBusiness: existingBusiness
      ? { digitalReceipts: existingBusiness.digitalReceipts, turnover: existingBusiness.turnover, section: existingBusiness.section }
      : null,
    receiptTotal,
    receiptDocumentId: receipts[0]?.documentId,
  });

  if (state.salary) {
    if (existingSalary) {
      await prisma.salaryIncome.update({ where: { id: existingSalary.id }, data: state.salary });
    } else {
      await prisma.salaryIncome.create({ data: { returnId, ...state.salary } });
    }
  }

  if (state.interest) {
    if (existingInterest) {
      await prisma.otherIncome.update({
        where: { id: existingInterest.id },
        data: { amount: state.interest.amount, source: state.interest.source },
      });
    } else if (state.interest.amount > 0) {
      await prisma.otherIncome.create({
        data: { returnId, kind: "Interest", amount: state.interest.amount, source: state.interest.source },
      });
    }
  }

  if (state.dividend) {
    if (existingDividend) {
      await prisma.otherIncome.update({
        where: { id: existingDividend.id },
        data: { amount: state.dividend.amount, source: state.dividend.source },
      });
    } else if (state.dividend.amount > 0) {
      await prisma.otherIncome.create({
        data: { returnId, kind: "Dividend", amount: state.dividend.amount, source: state.dividend.source },
      });
    }
  }

  if (state.business && receiptTotal > 0 && shouldOverwriteFromVerified(prep.fields["business.receipts"])) {
    if (existingBusiness) {
      await prisma.businessIncome.update({
        where: { id: existingBusiness.id },
        data: { digitalReceipts: state.business.digitalReceipts, turnover: state.business.turnover },
      });
    } else {
      await prisma.businessIncome.create({
        data: {
          returnId,
          digitalReceipts: state.business.digitalReceipts,
          turnover: state.business.turnover,
          section: state.business.section || "44AD",
        },
      });
    }
  }

  await prisma.taxReturn.update({ where: { id: returnId }, data: { preparationJson: JSON.stringify(state.prep) } });
  await recomputeReturn(returnId);
}
