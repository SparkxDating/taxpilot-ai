import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ReturnNav } from "@/components/return-nav";
import { Badge, Button, Card, Input } from "@/components/ui";
import { classifyBankTxAction, reprocessDocumentAction, reviewExtractionAction } from "@/app/actions";
import { confidenceLevel, displayExtractionMethod } from "@/lib/documents/types";
import Link from "next/link";

export default async function DocumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; docId: string }>;
  searchParams: Promise<{ duplicate?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id, docId } = await params;
  const { duplicate } = await searchParams;
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
        {duplicate ? (
          <Card className="mt-4">
            <p className="font-medium">DUPLICATE_DOCUMENT</p>
            <p className="sans text-sm text-[#5c6773]">
              This file was already uploaded. It was not reprocessed and the original was not deleted. Tick “Upload even
              if this file is a duplicate” on the documents page if you need a second copy.
            </p>
          </Card>
        ) : null}
        {doc.errorMessage ? <p className="sans mt-2 text-sm text-amber-800">{doc.errorMessage}</p> : null}
        <form action={reprocessDocumentAction} className="mt-4">
          <input type="hidden" name="documentId" value={doc.id} />
          <Button type="submit" variant="outline">
            Reprocess
          </Button>
        </form>
        <div className="mt-6 space-y-3">
          {doc.extractions.map((e) => {
            const fact = doc.taxFacts.find((f) => f.field === e.fieldKey);
            const level = confidenceLevel(e.confidence);
            const low = level === "LOW";
            return (
              <Card key={e.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{e.fieldKey.startsWith("txn.") ? `AIS transaction ${e.fieldKey.slice(4)}` : e.fieldKey}</p>
                  <Badge tone={fact?.status === "CONFLICT" ? "err" : low ? "err" : e.confidence >= 0.9 ? "ok" : "warn"}>
                    {level} {(e.confidence * 100).toFixed(0)}%
                  </Badge>
                </div>
                {low ? <p className="text-sm text-amber-800">LOW CONFIDENCE — review before verifying.</p> : null}
                <p>Value: {e.extractedValue}</p>
                {e.originalValue ? <p className="sans text-xs">Original extracted value: {e.originalValue}</p> : null}
                {e.editedValue ? <p className="sans text-xs">User-edited value: {e.editedValue}</p> : null}
                <p className="sans text-xs text-[#5c6773]">
                  Source page {e.pageRef || "—"} · Extraction method {displayExtractionMethod(e.extractionMethod)}
                </p>
                <p className="sans text-xs text-[#5c6773]">Source text: {e.sourceText || "—"}</p>
                {fact?.normalizedTaxField ? (
                  <p className="sans text-xs text-[#5c6773]">Maps to {fact.normalizedTaxField}</p>
                ) : null}
                {fact?.status === "CONFLICT" ? (
                  <p className="text-sm text-red-800">CONFLICT — resolve it on the documents page. Verify is blocked.</p>
                ) : null}
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
                    <Button variant="outline">Edit</Button>
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
            <p className="sans text-xs text-[#5c6773]">
              Suggested categories are not tax facts. Only a saved verified category can affect the return.
            </p>
            {doc.bankTx.map((tx) => (
              <Card key={tx.id} className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm">
                    {tx.date} · {tx.description}
                  </p>
                  <p className="sans text-xs">
                    Dr {tx.debit} / Cr {tx.credit} · page {tx.sourcePage || "—"}
                  </p>
                  <p className="sans text-xs text-[#5c6773]">
                    raw {tx.rawCategory} · suggested {tx.suggestedCategory} · verified {tx.verifiedCategory || "null"}
                  </p>
                </div>
                <form action={classifyBankTxAction} className="flex gap-2">
                  <input type="hidden" name="txId" value={tx.id} />
                  <select
                    name="category"
                    defaultValue={tx.verifiedCategory || tx.suggestedCategory || "UNKNOWN"}
                    className="sans rounded-md border px-2 py-1 text-xs"
                  >
                    {["UNKNOWN", "SALARY", "BUSINESS_RECEIPT", "INTEREST", "DIVIDEND", "TRANSFER", "REFUND", "LOAN", "INVESTMENT", "CAPITAL_RECEIPT"].map(
                      (c) => (
                        <option key={c}>{c}</option>
                      ),
                    )}
                  </select>
                  <Button type="submit" variant="outline">
                    Verify category
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
