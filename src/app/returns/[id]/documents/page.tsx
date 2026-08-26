import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ReturnNav } from "@/components/return-nav";
import { Badge, Button, Card, Input, Label } from "@/components/ui";
import { reviewExtractionAction, uploadDocumentAction } from "@/app/actions";
import { MIN_AUTO_INSERT_CONFIDENCE } from "@/lib/providers/ocr";
import { inr } from "@/lib/utils";

export default async function DocsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const ret = await prisma.taxReturn.findFirst({
    where: { id, userId: session.userId },
    include: { documents: { include: { extractions: true } } },
  });
  if (!ret) notFound();
  return (
    <div>
      <SiteHeader authed name={session.name} />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <ReturnNav id={id} current="documents" />
        <h1 className="text-3xl">Documents</h1>
        <p className="sans mt-2 text-sm text-[#5c6773]">
          OCR is not configured in this environment. Uploads are stored privately. Low-confidence values are never written into the return automatically.
        </p>
        <Card className="mt-6">
          <form action={uploadDocumentAction} encType="multipart/form-data" className="space-y-3">
            <input type="hidden" name="returnId" value={id} />
            <Label>Type</Label>
            <select name="kind" className="sans w-full rounded-md border px-3 py-2 text-sm">
              {["FORM_16", "AIS", "FORM_26AS", "BANK_STATEMENT", "INTEREST_CERTIFICATE", "BROKER", "MF", "RENT", "PREVIOUS_ITR", "PNL", "BALANCE_SHEET"].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
            <Input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv" required />
            <Button>Upload</Button>
          </form>
        </Card>
        <div className="mt-6 space-y-3">
          {ret.documents.map((d) => (
            <Card key={d.id}>
              <div className="flex items-center justify-between">
                <p>{d.fileName}</p>
                <Badge>{d.status}</Badge>
              </div>
              {d.extractions.map((e) => (
                <div key={e.id} className="mt-3 rounded-lg bg-[#f7f3eb] p-3 text-sm">
                  <p>
                    Detected {e.fieldKey}: {e.numericValue != null ? inr(e.numericValue) : e.extractedValue}
                  </p>
                  <p className="sans text-xs text-[#5c6773]">
                    Source: {d.fileName} · confidence {(e.confidence * 100).toFixed(0)}% · {e.pageRef || "page n/a"}
                  </p>
                  {e.confidence < MIN_AUTO_INSERT_CONFIDENCE ? (
                    <p className="sans mt-1 text-xs text-amber-800">Below auto-insert threshold. Confirm only after you verify.</p>
                  ) : null}
                  <div className="mt-2 flex gap-2">
                    <form action={reviewExtractionAction}>
                      <input type="hidden" name="extractionId" value={e.id} />
                      <input type="hidden" name="decision" value="confirm" />
                      <Button type="submit">Confirm</Button>
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
                </div>
              ))}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
