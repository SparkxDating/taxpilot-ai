import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ReturnNav } from "@/components/return-nav";
import { Badge, Card } from "@/components/ui";
import { loadNormalized } from "@/lib/tax/load";
import { inr } from "@/lib/utils";

export default async function ReconcilePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const ret = await prisma.taxReturn.findFirst({ where: { id, userId: session.userId } });
  if (!ret) notFound();
  const data = await loadNormalized(id, session.userId);
  const ais = await prisma.documentExtraction.findMany({
    where: { document: { returnId: id, kind: { in: ["AIS", "FORM_26AS"] } } },
  });
  const aisInterest = ais.filter((e) => /interest/i.test(e.fieldKey)).reduce((s, e) => s + (e.numericValue || 0), 0);
  const aisSalary = ais.filter((e) => /salary/i.test(e.fieldKey)).reduce((s, e) => s + (e.numericValue || 0), 0);
  const aisTds = ais.filter((e) => /tds/i.test(e.fieldKey)).reduce((s, e) => s + (e.numericValue || 0), 0);
  const salary = data?.salary.gross || 0;
  const interest = data?.otherIncome.filter((o) => /interest/i.test(o.kind)).reduce((s, o) => s + o.amount, 0) || 0;
  const tds = (data?.tds.reduce((s, t) => s + t.amount, 0) || 0) + (data?.salary.tds || 0);
  const rows = [
    ["Salary", salary, aisSalary],
    ["Interest", interest, aisInterest],
    ["TDS", tds, aisTds],
  ] as const;
  return (
    <div>
      <SiteHeader authed name={session.name} />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <ReturnNav id={id} current="reconcile" />
        <h1 className="text-3xl">AIS / 26AS reconciliation</h1>
        <p className="sans mt-2 text-sm text-[#5c6773]">AIS figures are for review. They are not assumed correct and do not overwrite your return.</p>
        <Card className="mt-6 overflow-x-auto">
          <table className="sans w-full text-left text-sm">
            <thead>
              <tr className="text-[#5c6773]">
                <th className="py-2">Income source</th>
                <th>Return</th>
                <th>AIS</th>
                <th>Difference</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([name, retAmt, aisAmt]) => {
                const diff = retAmt - aisAmt;
                const status = !aisAmt && !retAmt ? "—" : diff === 0 ? "Match" : "Review";
                return (
                  <tr key={name} className="border-t border-[#efe8da]">
                    <td className="py-3">{name}</td>
                    <td>{inr(retAmt)}</td>
                    <td>{inr(aisAmt)}</td>
                    <td>{inr(diff)}</td>
                    <td>{status === "Match" ? <Badge tone="ok">✓</Badge> : status === "Review" ? <Badge tone="warn">⚠</Badge> : status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
