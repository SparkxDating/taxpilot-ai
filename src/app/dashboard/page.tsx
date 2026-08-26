import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Badge, Button, Card, Disclaimer } from "@/components/ui";
import { inr, json } from "@/lib/utils";
import Link from "next/link";
import type { TaxComputation } from "@/lib/tax/engine";

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/login");
  const ret = await prisma.taxReturn.findFirst({
    where: { userId: session.userId },
    orderBy: { updatedAt: "desc" },
    include: { documents: true, questions: true, validationErrors: true },
  });
  const calc = json<Partial<TaxComputation>>(ret?.calculationJson, {});
  const pendingQ = ret?.questions.filter((q) => q.status === "PENDING").length || 0;
  const errors = ret?.validationErrors.filter((e) => e.severity === "ERROR") || [];
  const docsMissing = !ret?.documents.length;
  return (
    <div>
      <SiteHeader authed name={session.name} admin={session.role === "ADMIN"} />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="sans text-sm text-[#5c6773]">Welcome, {session.name}</p>
        <h1 className="mt-1 text-4xl">Your tax workspace</h1>
        {!ret ? (
          <Card className="mt-8">
            <p>No return yet for AY 2026–27.</p>
            <Link href="/returns/new" className="mt-4 inline-block">
              <Button>Create tax return</Button>
            </Link>
          </Card>
        ) : (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <p className="sans text-xs uppercase tracking-wide text-[#5c6773]">Assessment year</p>
                <p className="mt-1 text-2xl">{ret.assessmentYear}</p>
              </Card>
              <Card>
                <p className="sans text-xs uppercase tracking-wide text-[#5c6773]">ITR type</p>
                <p className="mt-1 text-2xl">{ret.itrType}</p>
              </Card>
              <Card>
                <p className="sans text-xs uppercase tracking-wide text-[#5c6773]">Completion</p>
                <p className="mt-1 text-2xl">{ret.completionPercentage}%</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#efe8da]">
                  <div className="h-1.5 bg-[#1f4e46]" style={{ width: `${ret.completionPercentage}%` }} />
                </div>
              </Card>
              <Card>
                <p className="sans text-xs uppercase tracking-wide text-[#5c6773]">
                  {(calc.refundOrPayable || 0) >= 0 ? "Estimated refund" : "Estimated payable"}
                </p>
                <p className="mt-1 text-2xl">{inr(Math.abs(calc.refundOrPayable || 0))}</p>
                <p className="sans mt-1 text-xs text-[#5c6773]">Tax {inr(ret.estimatedTax)}</p>
              </Card>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Card>
                <p className="font-medium">Documents</p>
                <p className="sans mt-2 text-sm text-[#5c6773]">{docsMissing ? "No documents uploaded yet." : `${ret.documents.length} uploaded`}</p>
              </Card>
              <Card>
                <p className="font-medium">Pending questions</p>
                <p className="sans mt-2 text-sm">{pendingQ}</p>
              </Card>
              <Card>
                <p className="font-medium">Validation</p>
                {errors.length ? <Badge tone="err">{errors.length} issues</Badge> : <Badge tone="ok">No blocking errors</Badge>}
              </Card>
            </div>
            <div className="mt-6">
              <Link href={`/returns/${ret.id}/interview`}>
                <Button>Continue Return</Button>
              </Link>
            </div>
          </>
        )}
        <div className="mt-10">
          <Disclaimer />
        </div>
      </div>
    </div>
  );
}
