import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ReturnNav } from "@/components/return-nav";
import { Badge, Button, Card, Input, Label } from "@/components/ui";
import { applyVerifiedDocumentsAction, resolveConflictAction, uploadDocumentAction } from "@/app/actions";
import { DOCUMENT_TYPES } from "@/lib/documents/types";
import { reconcileTds } from "@/lib/documents/tdsReconcile";
import {
  PROCESSABLE_DOCUMENT_TYPES,
  documentStatusView,
  extractedFactLabels,
  parsePreparation,
  processableDocumentLabel,
  uploadErrorMessage,
} from "@/lib/documents/prefill";
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
  const prep = parsePreparation(ret.preparationJson);
  const appliedTotal = Object.values(prep.fields).filter((e) => e.origin === "IMPORTED" || e.origin === "USER_EDITED").length;
  const errorText = uploadErrorMessage(error);
  return (
    <div>
      <SiteHeader authed name={session.name} />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <ReturnNav id={id} current="documents" />
        <h1 className="text-3xl">Upload your tax documents</h1>
        <p className="sans mt-2 text-sm text-[#5c6773]">
          Your verified documents can automatically populate your ITR-4 preparation.
        </p>
        <ul className="sans mt-3 space-y-1 text-sm text-[#5c6773]">
          {PROCESSABLE_DOCUMENT_TYPES.map((kind) => (
            <li key={kind}>✓ {processableDocumentLabel(kind)}</li>
          ))}
        </ul>
        {errorText ? <p className="sans mt-3 text-sm text-red-800">{errorText}</p> : null}
        {conflict ? (
          <p className="sans mt-2 text-sm text-red-800">
            Some information conflicts with another document.{" "}
            <a href="#conflicts" className="underline">
              Review conflict
            </a>
          </p>
        ) : null}
        {tdsStatus && tdsStatus !== "MATCHED" ? (
          <Card className="mt-4">
            <p className="font-medium">TDS reconciliation: {tdsStatus}</p>
            <p className="sans text-sm text-[#5c6773]">Form 16 TDS and AIS TDS differ or one is missing. Resolve before JSON.</p>
          </Card>
        ) : null}
        {appliedTotal > 0 ? (
          <Card className="mt-4">
            <p className="font-medium">Verified information added to your ITR-4.</p>
            <p className="sans text-sm text-[#5c6773]">{appliedTotal} fields updated</p>
          </Card>
        ) : null}
        <Card className="mt-6">
          <form action={uploadDocumentAction} encType="multipart/form-data" className="space-y-3">
            <input type="hidden" name="returnId" value={id} />
            <Label htmlFor="document-kind">Document type</Label>
            <select
              id="document-kind"
              name="kind"
              aria-label="Document type"
              className="sans w-full min-h-11 rounded-md border px-3 py-2 text-sm"
            >
              {DOCUMENT_TYPES.map((k) => (
                <option key={k} value={k}>
                  {processableDocumentLabel(k)}
                </option>
              ))}
            </select>
            <Label htmlFor="document-file">File</Label>
            <Input
              id="document-file"
              name="file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv,.txt"
              required
              aria-label="Upload your tax documents"
              className="min-h-11"
            />
            <label className="sans flex items-start gap-2 text-xs text-[#5c6773]">
              <input type="checkbox" name="force" value="1" className="mt-0.5" />
              Upload even if this file is a duplicate
            </label>
            <Button type="submit" className="min-h-11 w-full sm:w-auto" aria-label="Upload document">
              Upload document
            </Button>
          </form>
        </Card>
        <div className="mt-6 space-y-3">
          {ret.documents.map((d) => {
            const conf = avgConfidence(d.extractions);
            const warnings = [d.errorCode].filter((c) => c && c !== "EXTRACTION_FAILED");
            const conflictCount = d.taxFacts.filter((f) => f.status === "CONFLICT").length;
            const view = documentStatusView({
              status: d.status,
              errorCode: d.errorCode,
              factStatuses: d.taxFacts.map((f) => f.status),
            });
            const facts = extractedFactLabels(d.taxFacts);
            const needsVerify = d.taxFacts.some((f) => ["AI_EXTRACTED", "PENDING"].includes(f.status) || (!f.verified && f.status !== "REJECTED"));
            const appliedHere = Object.values(prep.fields).filter(
              (e) => e.sourceDocumentId === d.id && (e.origin === "IMPORTED" || e.origin === "USER_EDITED"),
            ).length;
            const processed = d.processedAt ? d.processedAt.toISOString().slice(0, 10) : "Not processed";
            return (
              <Card key={d.id} className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <Link href={`/returns/${id}/documents/${d.id}`} className="font-medium break-all">
                    {d.fileName}
                  </Link>
                  <p className="sans mt-1 text-xs text-[#5c6773]">
                    Type {processableDocumentLabel(d.kind)} · Last processed {processed}
                    {conf != null ? ` · Confidence ${(conf * 100).toFixed(0)}%` : ""}
                    {warnings.length ? ` · Warnings ${warnings.join(", ")}` : ""}
                  </p>
                  {view.label === "PROCESSING" ? <p className="sans mt-1 text-sm text-[#5c6773]">Processing document…</p> : null}
                  {view.label === "EXTRACTED" || facts.length ? (
                    <p className="sans mt-2 text-sm">
                      {processableDocumentLabel(d.kind)}
                      {view.label === "EXTRACTED" || view.label === "VERIFIED" ? " · Processed" : ""}
                    </p>
                  ) : null}
                  {facts.length ? (
                    <p className="sans text-xs text-[#5c6773]">Facts found: {facts.join(", ")}</p>
                  ) : null}
                  {appliedHere > 0 ? (
                    <p className="sans mt-1 text-xs text-[#5c6773]">Verified information added to your ITR-4. {appliedHere} fields updated</p>
                  ) : null}
                  {view.label === "CONFLICT" || conflictCount ? (
                    <p className="sans mt-1 text-sm text-red-800">
                      Some information conflicts with another document.{" "}
                      <a href="#conflicts" className="underline">
                        Review conflict
                      </a>
                    </p>
                  ) : null}
                  {view.label === "FAILED" ? <p className="sans mt-1 text-sm text-red-800">Document could not be processed.</p> : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {needsVerify || view.label === "NEEDS REVIEW" || view.label === "EXTRACTED" ? (
                      <Link
                        href={`/returns/${id}/documents/${d.id}`}
                        className="sans inline-flex min-h-11 items-center rounded-md border border-[#d7cfc0] bg-white px-4 py-2 text-sm"
                      >
                        Review & Verify
                      </Link>
                    ) : (
                      <Link
                        href={`/returns/${id}/documents/${d.id}`}
                        className="sans inline-flex min-h-11 items-center rounded-md border border-[#d7cfc0] bg-white px-4 py-2 text-sm"
                      >
                        Review
                      </Link>
                    )}
                  </div>
                </div>
                <Badge tone={view.tone}>
                  {view.prefix ? `${view.prefix} ` : ""}
                  {view.label}
                </Badge>
              </Card>
            );
          })}
        </div>
        {openConflicts.length ? (
          <div id="conflicts" className="mt-8 space-y-3">
            <h2 className="text-xl">Conflict review</h2>
            <p className="sans text-sm text-[#5c6773]">Some information conflicts with another document.</p>
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
                      <Button type="submit" variant="outline" className="min-h-11" aria-label={`Use ${f.documentType.replaceAll("_", " ")}`}>
                        Use {f.documentType.replaceAll("_", " ")}
                      </Button>
                    </form>
                  ))}
                  <form action={resolveConflictAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="conflictId" value={c.id} />
                    <input type="hidden" name="resolution" value="MANUAL_VALUE" />
                    <Input name="value" placeholder="Enter value" aria-label="Enter a value to resolve this conflict" className="min-h-11" />
                    <Button type="submit" className="min-h-11">
                      Enter Value
                    </Button>
                  </form>
                  <form action={resolveConflictAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="conflictId" value={c.id} />
                    <input type="hidden" name="resolution" value="IGNORE_WITH_REASON" />
                    <Input name="reason" placeholder="Reason to ignore" aria-label="Reason to ignore this conflict" className="min-h-11" />
                    <Button type="submit" variant="ghost" className="min-h-11">
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
            <Link href={queue[0]?.sourceDocumentId ? `/returns/${id}/documents/${queue[0].sourceDocumentId}` : `#`} className="sans mt-3 inline-flex min-h-11 items-center text-sm underline">
              Review & Verify
            </Link>
          </Card>
        ) : null}
        <form action={applyVerifiedDocumentsAction} className="mt-6">
          <input type="hidden" name="returnId" value={id} />
          <Button type="submit" className="min-h-11 w-full sm:w-auto" aria-label="Apply verified facts to return">
            Apply verified facts to return
          </Button>
        </form>
      </div>
    </div>
  );
}
