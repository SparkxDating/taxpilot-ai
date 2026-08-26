import { NextResponse } from "next/server";
import { authed, loadOwnedReturn } from "../../../_util";
import { loadNormalized } from "@/lib/tax/load";
import { prisma } from "@/lib/db";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await authed();
  if (!session) return error;
  const { id } = await params;
  const found = await loadOwnedReturn(id, session.userId, session.role);
  if (!found.ret) return found.error;
  const data = await loadNormalized(id);
  if (!data) return NextResponse.json({ rows: [] });
  const ais = await prisma.documentExtraction.findMany({
    where: { document: { returnId: id, kind: { in: ["AIS", "FORM_26AS"] } }, status: { in: ["CONFIRMED", "EXTRACTED", "NEEDS_REVIEW"] } },
  });
  const aisInterest = ais.filter((e) => /interest/i.test(e.fieldKey)).reduce((s, e) => s + (e.numericValue || 0), 0);
  const aisSalary = ais.filter((e) => /salary/i.test(e.fieldKey)).reduce((s, e) => s + (e.numericValue || 0), 0);
  const aisTds = ais.filter((e) => /tds/i.test(e.fieldKey)).reduce((s, e) => s + (e.numericValue || 0), 0);
  const salary = data.salary.gross;
  const interest = data.otherIncome.filter((o) => /interest/i.test(o.kind)).reduce((s, o) => s + o.amount, 0);
  const tds = data.tds.reduce((s, t) => s + t.amount, 0) + data.salary.tds;
  const rows = [
    { source: "Salary", returnAmount: salary, aisAmount: aisSalary, difference: salary - aisSalary },
    { source: "Interest", returnAmount: interest, aisAmount: aisInterest, difference: interest - aisInterest },
    { source: "TDS", returnAmount: tds, aisAmount: aisTds, difference: tds - aisTds },
  ].map((r) => ({
    ...r,
    status: !r.aisAmount && !r.returnAmount ? "NA" : r.difference === 0 ? "MATCH" : "REVIEW",
  }));
  return NextResponse.json({ rows, note: "AIS values are for review only and are never assumed correct." });
}
