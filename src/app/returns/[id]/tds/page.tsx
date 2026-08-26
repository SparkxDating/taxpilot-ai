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
            <Label>Advance tax paid on</Label>
            <Input name="advanceTaxDate" type="date" defaultValue={adv?.paidOn?.toISOString().slice(0, 10)} />
            <Label>Self-assessment tax</Label>
            <Input name="selfAsst" type="number" defaultValue={sa?.amount || ""} />
            <Label>Self-assessment tax paid on</Label>
            <Input name="selfAsstDate" type="date" defaultValue={sa?.paidOn?.toISOString().slice(0, 10)} />
            <p className="sans text-xs text-[#5c6773]">
              Interest calculation requires additional information. If advance tax is paid, enter the payment date or JSON generation is blocked.
            </p>
            <Label>Bank name</Label>
            <Input name="bankName" defaultValue={b?.bankName} required />
            <Label>Primary bank IFSC</Label>
            <Input name="ifsc" placeholder="11-character IFSC" defaultValue={b?.ifsc} required />
            <Label>Account number</Label>
            <Input name="accountNumber" defaultValue={b?.accountNumber} required />
            <Label>Account type</Label>
            <select name="accountType" defaultValue={b?.accountType || "SB"} className="sans w-full rounded-md border px-3 py-2 text-sm">
              <option value="SB">Savings</option>
              <option value="CA">Current</option>
            </select>
            <Button>Save and run checks</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
