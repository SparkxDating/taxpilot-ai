import { prisma } from "@/lib/db";
import { recomputeReturn } from "@/lib/tax/persist";

/** Apply VERIFIED TaxFacts only. Never called from extractors. Never writes ITR JSON. */
export async function applyVerifiedFactsToTaxModel(returnId: string) {
  const facts = await prisma.taxFact.findMany({ where: { returnId, verified: true, status: "VERIFIED" } });
  const num = (field: string) => facts.find((f) => f.field === field)?.numericValue ?? null;
  const str = (field: string) => facts.find((f) => f.field === field)?.value || "";

  const gross = num("grossSalary");
  const tds = num("tds");
  if (gross != null || tds != null) {
    const existing = await prisma.salaryIncome.findFirst({ where: { returnId } });
    await prisma.salaryIncome.deleteMany({ where: { returnId } });
    await prisma.salaryIncome.create({
      data: {
        returnId,
        grossSalary: gross ?? existing?.grossSalary ?? 0,
        tds: tds ?? existing?.tds ?? 0,
        employerName: str("employerName") || existing?.employerName || "",
        employerTan: str("employerTan") || existing?.employerTan || "",
      },
    });
  }

  const interest = num("ais.interest");
  if (interest != null && interest > 0) {
    await prisma.otherIncome.deleteMany({ where: { returnId, kind: "Interest" } });
    await prisma.otherIncome.create({
      data: { returnId, kind: "Interest", amount: interest, source: "AIS (verified)" },
    });
  }

  const dividend = num("ais.dividend");
  if (dividend != null && dividend > 0) {
    await prisma.otherIncome.deleteMany({ where: { returnId, kind: "Dividend" } });
    await prisma.otherIncome.create({
      data: { returnId, kind: "Dividend", amount: dividend, source: "AIS (verified)" },
    });
  }

  await recomputeReturn(returnId);
}
