import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ReturnNav } from "@/components/return-nav";
import { Button, Card, Input, Label } from "@/components/ui";
import { saveTdsBankAction } from "@/app/actions";

export default async function TdsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const ret = await prisma.taxReturn.findFirst({
    where: { id, userId: session.userId },
    include: { tdsEntries: true, taxPayments: true, bankAccounts: true },
  });
  if (!ret) notFound();
  const t = ret.tdsEntries[0];
  const b = ret.bankAccounts[0];
  const adv = ret.taxPayments.find((p) => p.kind === "ADVANCE");
  const sa = ret.taxPayments.find((p) => p.kind === "SELF_ASSESSMENT");
  return (
    <div>
      <SiteHeader authed name={session.name} />
      <div className="mx-auto max-w-2xl px-6 py-8">
        <ReturnNav id={id} current="tds" />
        <h1 className="text-3xl">TDS, payments & bank</h1>
        <Card className="mt-6">
          <form action={saveTdsBankAction} className="space-y-3">
            <input type="hidden" name="returnId" value={id} />
            <Label>TDS (other than salary)</Label>
            <Input name="tdsSection" placeholder="Section e.g. 194A" defaultValue={t?.sectionCode} />
            <Input name="tdsTan" placeholder="TAN" defaultValue={t?.tan} />
            <Input name="tdsName" placeholder="Deductor" defaultValue={t?.deductorName} />
            <Input name="tdsAmount" type="number" placeholder="TDS amount" defaultValue={t?.amount || ""} />
            <Label>Advance tax</Label>
            <Input name="advanceTax" type="number" defaultValue={adv?.amount || ""} />
            <Label>Self-assessment tax</Label>
            <Input name="selfAsst" type="number" defaultValue={sa?.amount || ""} />
            <Label>Primary bank IFSC</Label>
            <Input name="ifsc" placeholder="HDFC0001234" defaultValue={b?.ifsc} required />
            <Label>Account number</Label>
            <Input name="accountNumber" defaultValue={b?.accountNumber} required />
            <Button>Save and run checks</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
