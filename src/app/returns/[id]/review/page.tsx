import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ReturnNav } from "@/components/return-nav";
import { Badge, Card } from "@/components/ui";
import { ValidationIssue } from "@/components/validation-issue";
import { json, inr, maskAccount, maskPan } from "@/lib/utils";
import type { TaxComputation } from "@/lib/tax/engine";
import Link from "next/link";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const ret = await prisma.taxReturn.findFirst({
    where: { id, userId: session.userId },
    include: {
      user: { include: { profile: true } },
      salary: true,
      business: true,
      professional: true,
      houseProperties: true,
      capitalGains: true,
      otherIncomes: true,
      deductions: true,
      tdsEntries: true,
      taxPayments: true,
      bankAccounts: true,
      validationErrors: true,
    },
  });
  if (!ret) notFound();
  const calc = json<TaxComputation>(ret.calculationJson, {} as TaxComputation);
  const err = (section: string) => ret.validationErrors.filter((e) => e.section === section);
  const mark = (section: string) => {
    const rows = err(section);
    if (rows.some((r) => r.severity === "ERROR")) return { tone: "err" as const, label: "✕ Error" };
    if (rows.some((r) => r.severity === "WARNING")) return { tone: "warn" as const, label: "⚠ Review" };
    return { tone: "ok" as const, label: "✓ Complete" };
  };
  const sections = [
    ["Personal information", `/returns/${id}/profile`, `PAN ${maskPan(ret.user.profile?.pan || "")}`],
    ["Income", `/returns/${id}/income`, `Salary ${inr(calc.salaryIncome || 0)}`],
    ["Business/Profession", `/returns/${id}/income`, `BP ${inr((calc.businessIncome || 0) + (calc.professionIncome || 0))}`],
    ["House property", `/returns/${id}/income`, inr(calc.housePropertyIncome || 0)],
    ["Capital gains", `/returns/${id}/income`, inr(calc.capitalGains || 0)],
    ["Other sources", `/returns/${id}/income`, inr(calc.otherSources || 0)],
    ["Deductions", `/returns/${id}/deductions`, inr(calc.deductions || 0)],
    ["TDS", `/returns/${id}/tds`, inr(calc.tds || 0)],
    ["Tax payments", `/returns/${id}/tds`, inr((calc.advanceTax || 0) + (calc.selfAssessmentTax || 0))],
    ["Bank details", `/returns/${id}/tds`, ret.bankAccounts[0] ? maskAccount(ret.bankAccounts[0].accountNumber) : "Missing"],
    ["Tax calculation", `/returns/${id}/summary`, `Tax ${inr(calc.totalTax || 0)}`],
    ["Validation", `/returns/${id}/validate`, `${ret.validationErrors.filter((e) => e.severity === "ERROR").length} errors`],
  ] as const;
  return (
    <div>
      <SiteHeader authed name={session.name} />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <ReturnNav id={id} current="review" />
        <h1 className="text-3xl">Return review</h1>
        <p className="sans mt-2 text-sm text-[#5c6773]">
          Selected regime: {ret.taxRegime === "OLD" ? "Old regime" : "New regime"} · Taxable income {inr(calc.taxableIncome || 0)} · Eligible
          deductions {inr(calc.deductions || 0)} · Final tax {inr(calc.totalTax || 0)}
        </p>
        <Card className="mt-4 sans text-sm space-y-1">
          <p>Normal-rate taxable income: {inr(calc.normalRateIncome || 0)}</p>
          <p>Special-rate taxable income (s.112A): {inr(calc.specialRateIncome || 0)}</p>
          <p>Tax on normal-rate income: {inr(calc.taxBeforeRebate || 0)}</p>
          <p>Tax on special-rate income: {inr(calc.taxOnSpecialRate || 0)}</p>
          <p>Rebate u/s 87A: {inr(calc.rebate || 0)}</p>
          <p>Surcharge: {inr(calc.surcharge || 0)}</p>
          <p>Cess: {inr(calc.cess || 0)}</p>
          <p>Total tax: {inr(calc.totalTax || 0)}</p>
          <p>
            Settlement: {calc.settlement?.status || (calc.isRefund ? "REFUND" : calc.totalTax ? "TAX_PAYABLE" : "ZERO")}{" "}
            {inr(calc.settlement?.amount ?? Math.abs(calc.refundOrPayable || 0))}
          </p>
        </Card>
        <div className="mt-6 space-y-2">
          {sections.map(([label, href, detail]) => {
            const m = mark(label);
            return (
              <Card key={label} className="flex items-center justify-between gap-3">
                <div>
                  <Link href={href} className="font-medium">
                    {label}
                  </Link>
                  <p className="sans text-xs text-[#5c6773]">{detail}</p>
                </div>
                <Badge tone={m.tone}>{m.label}</Badge>
              </Card>
            );
          })}
        </div>
        <div className="mt-6 space-y-3">
          {ret.validationErrors.map((e) => (
            <ValidationIssue key={e.id} severity={e.severity as "ERROR" | "WARNING" | "INFO"} title={e.section} message={e.message} suggestion={e.suggestion} href={e.href} />
          ))}
        </div>
      </div>
    </div>
  );
}
