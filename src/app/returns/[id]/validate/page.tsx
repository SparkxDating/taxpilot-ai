import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ReturnNav } from "@/components/return-nav";
import { Badge, Button, Card } from "@/components/ui";
import { loadNormalized } from "@/lib/tax/load";
import { generateITRJson } from "@/lib/itr-json/mapper";
import { ValidationIssue } from "@/components/validation-issue";
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
        {generated?.layers ? (
          <Card className="mt-4 sans text-sm space-y-1">
            <p>
              Schema integrity: {generated.layers.schemaIntegrity}
              {generated.layers.schemaIntegrity === "FAIL" ? " — ❌ Official schema verification failed" : ""}
            </p>
            <p>Data completeness: {generated.layers.dataCompleteness}</p>
            <p>Eligibility: {generated.layers.eligibility}</p>
            <p>Business rules: {generated.layers.businessRules}</p>
            <p>Tax calculation: {generated.layers.taxCalculation}</p>
            <p>Official schema: {generated.layers.schema}</p>
            <p>Unsupported scenarios: {generated.layers.unsupported}</p>
          </Card>
        ) : null}
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
            <ValidationIssue
              key={e.id}
              severity={e.severity as "ERROR" | "WARNING" | "INFO"}
              title={e.section}
              message={e.message}
              suggestion={e.suggestion}
              href={e.href || `/returns/${id}/income`}
            />
          ))}
        </div>
        {generated?.official.valid ? <p className="sans mt-4 text-sm text-emerald-800">Official AY 2026–27 schema validation passed.</p> : null}
        <Link href={`/returns/${id}/summary`} className="mt-6 inline-block">
          <Button>Go to summary</Button>
        </Link>
      </div>
    </div>
  );
}
