import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ReturnNav } from "@/components/return-nav";
import { Badge, Button, Card, Input } from "@/components/ui";
import { classifyBankTxAction, reviewExtractionAction } from "@/app/actions";
import { confidenceLevel } from "@/lib/documents/types";
import Link from "next/link";

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string; docId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id, docId } = await params;
  const doc = await prisma.document.findFirst({
    where: { id: docId, userId: session.userId, returnId: id },
    include: { extractions: true, taxFacts: true, bankTx: true },
  });
  if (!doc) notFound();
  return (
    <div>
      <SiteHeader authed name={session.name} />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <ReturnNav id={id} current="documents" />
        <p className="sans text-sm">
          <Link href={`/returns/${id}/documents`}>← Documents</Link>
        </p>
        <h1 className="mt-2 text-3xl">{doc.kind.replaceAll("_", " ")}</h1>
        <p className="sans mt-1 text-sm text-[#5c6773]">
          {doc.fileName} · {doc.status}
          {doc.errorCode ? ` · ${doc.errorCode}` : ""}
        </p>
        {doc.errorMessage ? <p className="sans mt-2 text-sm text-amber-800">{doc.errorMessage}</p> : null}
        <div className="mt-6 space-y-3">
          {doc.extractions.map((e) => {
            const fact = doc.taxFacts.find((f) => f.field === e.fieldKey);
            return (
              <Card key={e.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{e.fieldKey}</p>
                  <Badge tone={fact?.status === "CONFLICT" ? "err" : e.confidence >= 0.9 ? "ok" : "warn"}>
                    {confidenceLevel(e.confidence)} {(e.confidence * 100).toFixed(0)}%
                  </Badge>
                </div>
                <p>Extracted: {e.extractedValue}</p>
                {e.originalValue && e.originalValue !== e.extractedValue ? (
                  <p className="sans text-xs">Original: {e.originalValue}</p>
                ) : null}
                <p className="sans text-xs text-[#5c6773]">
                  Page {e.pageRef || "—"} · {e.extractionMethod} · {e.sourceText || "no snippet"}
                </p>
                {fact?.status === "CONFLICT" ? <p className="text-sm text-red-800">CONFLICT with another verified source. Resolve manually.</p> : null}
                <div className="flex flex-wrap gap-2">
                  <form action={reviewExtractionAction}>
                    <input type="hidden" name="extractionId" value={e.id} />
                    <input type="hidden" name="decision" value="confirm" />
                    <Button type="submit">Verify</Button>
                  </form>
                  <form action={reviewExtractionAction} className="flex gap-2">
                    <input type="hidden" name="extractionId" value={e.id} />
                    <input type="hidden" name="decision" value="edit" />
                    <Input name="edited" placeholder="Edit value" />
                    <Button variant="outline">Save edit</Button>
                  </form>
                  <form action={reviewExtractionAction}>
                    <input type="hidden" name="extractionId" value={e.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <Button variant="ghost">Reject</Button>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>
        {doc.bankTx.length ? (
          <div className="mt-8">
            <h2 className="text-xl">Transactions</h2>
            <p className="sans text-xs text-[#5c6773]">Credits are not income until classified and verified.</p>
            {doc.bankTx.map((tx) => (
              <Card key={tx.id} className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm">
                    {tx.date} · {tx.description}
                  </p>
                  <p className="sans text-xs">
                    Dr {tx.debit} / Cr {tx.credit} · {tx.category}
                  </p>
                </div>
                <form action={classifyBankTxAction} className="flex gap-2">
                  <input type="hidden" name="txId" value={tx.id} />
                  <select name="category" defaultValue={tx.category} className="sans rounded-md border px-2 py-1 text-xs">
                    {["UNKNOWN", "SALARY", "BUSINESS_RECEIPT", "INTEREST", "DIVIDEND", "TRANSFER", "REFUND", "LOAN", "INVESTMENT", "CAPITAL_RECEIPT"].map(
                      (c) => (
                        <option key={c}>{c}</option>
                      ),
                    )}
                  </select>
                  <Button type="submit" variant="outline">
                    Save
                  </Button>
                </form>
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
