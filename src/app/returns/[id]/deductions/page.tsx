import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ReturnNav } from "@/components/return-nav";
import { Button, Card, Input, Label } from "@/components/ui";
import { saveDeductionsAction } from "@/app/actions";

export default async function DeductionsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const ret = await prisma.taxReturn.findFirst({ where: { id, userId: session.userId }, include: { deductions: true } });
  if (!ret) notFound();
  const get = (s: string) => ret.deductions.find((d) => d.section === s)?.amount || "";
  return (
    <div>
      <SiteHeader authed name={session.name} />
      <div className="mx-auto max-w-2xl px-6 py-8">
        <ReturnNav id={id} current="deductions" />
        <h1 className="text-3xl">Deductions</h1>
        <p className="sans mt-2 text-sm text-[#5c6773]">
          Under the new regime most Chapter VI-A deductions are not applied. They are stored and used if you opt for the old regime.
        </p>
        <Card className="mt-6">
          <form action={saveDeductionsAction} className="space-y-3">
            <input type="hidden" name="returnId" value={id} />
            <div>
              <Label>80C</Label>
              <Input name="80C" type="number" defaultValue={get("80C")} />
            </div>
            <div>
              <Label>80D health insurance</Label>
              <Input name="80D" type="number" defaultValue={get("80D")} />
            </div>
            <div>
              <Label>80CCD(1B) NPS</Label>
              <Input name="80CCD(1B)" type="number" defaultValue={get("80CCD(1B)")} />
            </div>
            <div>
              <Label>80TTA savings interest</Label>
              <Input name="80TTA" type="number" defaultValue={get("80TTA")} />
            </div>
            <Button>Save deductions</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
