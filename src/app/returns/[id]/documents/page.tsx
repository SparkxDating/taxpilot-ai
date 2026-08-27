import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ReturnNav } from "@/components/return-nav";
import { Badge, Button, Card, Input, Label } from "@/components/ui";
import { applyVerifiedDocumentsAction, uploadDocumentAction } from "@/app/actions";
import { DOCUMENT_TYPES } from "@/lib/documents/types";
import { reconcileTds } from "@/lib/documents/tdsReconcile";
import Link from "next/link";

export default async function DocsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const { error } = await searchParams;
  const ret = await prisma.taxReturn.findFirst({
    where: { id, userId: session.userId },
    include: { documents: { include: { extractions: true, taxFacts: true } }, taxFacts: true },
  });
  if (!ret) notFound();
  const form16Tds = ret.taxFacts.find((f) => f.field === "tds")?.numericValue ?? null;
  const aisTds = ret.taxFacts.find((f) => f.field === "ais.tds")?.numericValue ?? null;
  const tdsStatus = form16Tds != null || aisTds != null ? reconcileTds(form16Tds, aisTds) : null;
  const queue = ret.taxFacts.filter((f) => ["PENDING", "CONFLICT"].includes(f.status) || (f.confidence < 0.7 && !f.verified));
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
            <Button>Upload Document</Button>
          </form>
        </Card>
        <div className="mt-6 space-y-2">
          {ret.documents.map((d) => (
            <Card key={d.id} className="flex items-center justify-between">
              <div>
                <Link href={`/returns/${id}/documents/${d.id}`} className="font-medium">
                  {d.kind.replaceAll("_", " ")}
                </Link>
                <p className="sans text-xs text-[#5c6773]">{d.fileName}</p>
              </div>
              <Badge tone={d.status === "VERIFIED" ? "ok" : d.status === "FAILED" ? "err" : "warn"}>{d.status}</Badge>
            </Card>
          ))}
        </div>
        {queue.length ? (
          <Card className="mt-6">
            <p className="font-medium">Review queue ({queue.length})</p>
            <ul className="sans mt-2 list-disc pl-5 text-sm">
              {queue.slice(0, 12).map((f) => (
                <li key={f.id}>
                  {f.field} · {f.status} · {(f.confidence * 100).toFixed(0)}%
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
