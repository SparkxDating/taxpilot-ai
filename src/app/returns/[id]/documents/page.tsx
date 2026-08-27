import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ReturnNav } from "@/components/return-nav";
import { Badge, Button, Card, Input, Label } from "@/components/ui";
import { applyVerifiedDocumentsAction, resolveConflictAction, uploadDocumentAction } from "@/app/actions";
import { DOCUMENT_TYPES } from "@/lib/documents/types";
import { reconcileTds } from "@/lib/documents/tdsReconcile";
import Link from "next/link";

function avgConfidence(extractions: Array<{ confidence: number }>) {
  if (!extractions.length) return null;
  return extractions.reduce((s, e) => s + e.confidence, 0) / extractions.length;
}

type ConflictFact = { id: string; documentType: string; value: string; numericValue: number | null };

export default async function DocsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; conflict?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const { error, conflict } = await searchParams;
  const ret = await prisma.taxReturn.findFirst({
    where: { id, userId: session.userId },
    include: {
      documents: { include: { extractions: true, taxFacts: true } },
      taxFacts: true,
      documentConflicts: true,
    },
  });
  if (!ret) notFound();
  const form16Tds = ret.taxFacts.find((f) => f.normalizedTaxField === "salary.tds" || f.field === "tds")?.numericValue ?? null;
  const aisTds = ret.taxFacts.find((f) => f.normalizedTaxField === "tds.ais" || f.field === "ais.tds")?.numericValue ?? null;
  const tdsStatus = form16Tds != null || aisTds != null ? reconcileTds(form16Tds, aisTds) : null;
  const queue = ret.taxFacts.filter((f) => ["AI_EXTRACTED", "PENDING", "CONFLICT"].includes(f.status) || (f.confidence < 0.7 && !f.verified));
  const openConflicts = ret.documentConflicts.filter((c) => c.status === "OPEN");
  return (
    <div>
      <SiteHeader authed name={session.name} />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <ReturnNav id={id} current="documents" />
        <h1 className="text-3xl">Documents</h1>
        <p className="sans mt-2 text-sm text-[#5c6773]">
          Local extraction only. Verified TaxFacts can be applied to the return. AI never writes ITR JSON.
        </p>
        {error ? <p className="sans mt-2 text-sm text-red-800">Upload rejected ({error}).</p> : null}
        {conflict ? (
          <p className="sans mt-2 text-sm text-red-800">This field is in conflict. Resolve it below before verifying.</p>
        ) : null}
        {tdsStatus && tdsStatus !== "MATCHED" ? (
          <Card className="mt-4">
            <p className="font-medium">TDS reconciliation: {tdsStatus}</p>
            <p className="sans text-sm text-[#5c6773]">Form 16 TDS and AIS TDS differ or one is missing. Resolve before JSON.</p>
          </Card>
        ) : null}
        <Card className="mt-6">
          <form action={uploadDocumentAction} encType="multipart/form-data" className="space-y-3">
            <input type="hidden" name="returnId" value={id} />
            <Label>Type</Label>
            <select name="kind" className="sans w-full rounded-md border px-3 py-2 text-sm">
              {DOCUMENT_TYPES.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
            <Input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv,.txt" required />
            <label className="sans flex items-center gap-2 text-xs text-[#5c6773]">
              <input type="checkbox" name="force" value="1" />
              Upload even if this file is a duplicate
            </label>
            <Button>Upload Document</Button>
          </form>
        </Card>
        <div className="mt-6 space-y-2">
          {ret.documents.map((d) => {
            const conf = avgConfidence(d.extractions);
            const warnings = [d.errorCode].filter((c) => c && c !== "EXTRACTION_FAILED");
            const conflictCount = d.taxFacts.filter((f) => f.status === "CONFLICT").length;
            return (
              <Card key={d.id} className="flex items-center justify-between gap-3">
                <div>
                  <Link href={`/returns/${id}/documents/${d.id}`} className="font-medium">
                    {d.fileName}
                  </Link>
                  <p className="sans text-xs text-[#5c6773]">
                    Type {d.kind.replaceAll("_", " ")}
                    {conf != null ? ` · Confidence ${(conf * 100).toFixed(0)}%` : ""}
                    {warnings.length ? ` · Warnings ${warnings.join(", ")}` : ""}
                    {conflictCount ? ` · Conflicts ${conflictCount}` : ""}
                  </p>
                </div>
                <Badge tone={d.status === "VERIFIED" ? "ok" : d.status === "FAILED" ? "err" : "warn"}>{d.status}</Badge>
              </Card>
            );
          })}
        </div>
        {openConflicts.length ? (
          <div className="mt-8 space-y-3">
            <h2 className="text-xl">Conflict review</h2>
            {openConflicts.map((c) => {
              const facts = JSON.parse(c.factsJson || "[]") as ConflictFact[];
              return (
                <Card key={c.id} className="space-y-3">
                  <p className="font-medium">{c.field} CONFLICT</p>
                  {facts.map((f) => (
                    <form key={f.id} action={resolveConflictAction} className="flex flex-wrap items-center justify-between gap-2">
                      <p className="sans text-sm">
                        {f.documentType.replaceAll("_", " ")} — ₹{f.value}
                      </p>
                      <input type="hidden" name="conflictId" value={c.id} />
                      <input type="hidden" name="resolution" value="USE_SOURCE" />
                      <input type="hidden" name="factId" value={f.id} />
                      <Button type="submit" variant="outline">
                        Use {f.documentType.replaceAll("_", " ")}
                      </Button>
                    </form>
                  ))}
                  <form action={resolveConflictAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="conflictId" value={c.id} />
                    <input type="hidden" name="resolution" value="MANUAL_VALUE" />
                    <Input name="value" placeholder="Enter value" />
                    <Button type="submit">Enter Value</Button>
                  </form>
                  <form action={resolveConflictAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="conflictId" value={c.id} />
                    <input type="hidden" name="resolution" value="IGNORE_WITH_REASON" />
                    <Input name="reason" placeholder="Reason to ignore" />
                    <Button type="submit" variant="ghost">
                      Ignore
                    </Button>
                  </form>
                  <p className="sans text-xs text-[#5c6773]">Keep Unresolved — leave this conflict open. JSON stays blocked.</p>
                </Card>
              );
            })}
          </div>
        ) : null}
        {queue.length ? (
          <Card className="mt-6">
            <p className="font-medium">Review queue ({queue.length})</p>
            <ul className="sans mt-2 list-disc pl-5 text-sm">
              {queue.slice(0, 12).map((f) => (
                <li key={f.id}>
                  {f.normalizedTaxField || f.field} · {f.status} · {(f.confidence * 100).toFixed(0)}%
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
        <form action={applyVerifiedDocumentsAction} className="mt-6">
          <input type="hidden" name="returnId" value={id} />
          <Button type="submit">Apply verified facts to return</Button>
        </form>
      </div>
    </div>
  );
}
