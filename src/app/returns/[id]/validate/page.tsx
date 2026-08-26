import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ReturnNav } from "@/components/return-nav";
import { Badge, Button, Card } from "@/components/ui";
import { loadNormalized } from "@/lib/tax/load";
import { generateITRJson } from "@/lib/itr-json/mapper";
import Link from "next/link";

export default async function ValidatePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const ret = await prisma.taxReturn.findFirst({ where: { id, userId: session.userId }, include: { validationErrors: true } });
  if (!ret) notFound();
  const data = await loadNormalized(id, session.userId);
  const generated = data ? generateITRJson(data) : null;
  const groups = [
    ["Personal information", "pan", "name"],
    ["Income", "grossTotalIncome", "turnover"],
    ["Deductions", "80C"],
    ["TDS", "tds", "tan"],
    ["Bank details", "ifsc", "accountNumber", "bankAccounts"],
    ["Official JSON schema", "ITR", "ITR4", "schemaSource"],
  ];
  return (
    <div>
      <SiteHeader authed name={session.name} />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <ReturnNav id={id} current="validate" />
        <h1 className="text-3xl">Return check</h1>
        <div className="mt-6 space-y-2">
          {groups.map(([label, ...fields]) => {
            const hits = ret.validationErrors.filter((e) => fields.includes(e.field) || e.section === label);
            const worst = hits.find((h) => h.severity === "ERROR") ? "err" : hits.find((h) => h.severity === "WARNING") ? "warn" : "ok";
            return (
              <Card key={label} className="flex items-center justify-between">
                <span>{label}</span>
                <Badge tone={worst}>{worst === "ok" ? "✓" : worst === "warn" ? "⚠" : "✕"}</Badge>
              </Card>
            );
          })}
        </div>
        <div className="mt-6 space-y-3">
          {ret.validationErrors.map((e) => (
            <Card key={e.id}>
              <Badge tone={e.severity === "ERROR" ? "err" : e.severity === "WARNING" ? "warn" : "muted"}>{e.severity}</Badge>
              <p className="mt-2">{e.message}</p>
              <p className="sans mt-1 text-sm text-[#5c6773]">{e.suggestion}</p>
              <Link href={e.href || `/returns/${id}/income`} className="sans mt-2 inline-block text-sm text-[#1f4e46]">
                Fix this →
              </Link>
            </Card>
          ))}
        </div>
        {generated?.valid ? <p className="sans mt-4 text-sm text-emerald-800">Adapter schema validation passed.</p> : null}
        <Link href={`/returns/${id}/summary`} className="mt-6 inline-block">
          <Button>Go to summary</Button>
        </Link>
      </div>
    </div>
  );
}
