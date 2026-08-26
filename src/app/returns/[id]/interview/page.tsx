import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ReturnNav } from "@/components/return-nav";
import { Badge, Button, Card } from "@/components/ui";
import { answerQuestionAction } from "@/app/actions";
import { parseOptions } from "@/lib/interview";
import { getAIProvider } from "@/lib/providers/ai";
import { json } from "@/lib/utils";
import type { EligibilityResult } from "@/lib/tax-rules/ay2026_27/eligibility";
import Link from "next/link";

export default async function Interview({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const ret = await prisma.taxReturn.findFirst({
    where: { id, userId: session.userId },
    include: { questions: { orderBy: { sortOrder: "asc" }, include: { answers: true } } },
  });
  if (!ret) notFound();
  const eligibility = json<EligibilityResult>(ret.eligibilityJson, { recommended: "ITR-4", itr4Eligible: true, reasons: [], warnings: [] });
  const pending = ret.questions.find((q) => q.status === "PENDING");
  const explainer = pending ? await getAIProvider().explain(pending.helpText || pending.prompt) : "";
  return (
    <div>
      <SiteHeader authed name={session.name} />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <ReturnNav id={id} current="interview" />
        <h1 className="text-3xl">Guided interview</h1>
        <p className="sans mt-2 text-sm text-[#5c6773]">
          Recommended form: <strong>{ret.itrType}</strong>. This decision is from published eligibility rules, not the assistant.
        </p>
        {!eligibility.itr4Eligible ? (
          <Card className="mt-4 border-amber-200">
            <p className="font-medium">ITR-4 does not apply</p>
            <ul className="sans mt-2 list-disc pl-5 text-sm">
              {eligibility.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="sans mt-2 text-sm">You are on the ITR-3 path. Detailed P&amp;L screens are available under Income.</p>
          </Card>
        ) : null}
        {pending ? (
          <Card className="mt-6">
            <p className="text-xl">{pending.prompt}</p>
            <p className="sans mt-3 text-sm text-[#5c6773]">{explainer}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {parseOptions(pending.optionsJson).map((opt) => (
                <form key={opt} action={answerQuestionAction}>
                  <input type="hidden" name="questionId" value={pending.id} />
                  <input type="hidden" name="value" value={opt} />
                  <Button type="submit" variant={opt === "Not sure" ? "outline" : "primary"}>
                    {opt}
                  </Button>
                </form>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="mt-6">
            <Badge tone="ok">Interview complete</Badge>
            <div className="mt-4">
              <Link href={`/returns/${id}/profile`}>
                <Button>Continue to personal information</Button>
              </Link>
            </div>
          </Card>
        )}
        <ul className="sans mt-6 space-y-1 text-sm text-[#5c6773]">
          {ret.questions.map((q) => (
            <li key={q.id}>
              {q.status === "ANSWERED" ? "✓" : "○"} {q.prompt} {q.answers[0] ? `— ${q.answers[0].value}` : ""}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
