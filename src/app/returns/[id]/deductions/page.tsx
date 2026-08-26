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
  const parentsSenior = ret.deductions.some((d) => d.section.startsWith("80D_PARENTS") && d.notes.includes('"senior":true'));
  return (
    <div>
      <SiteHeader authed name={session.name} />
      <div className="mx-auto max-w-2xl px-6 py-8">
        <ReturnNav id={id} current="deductions" />
        <h1 className="text-3xl">Deductions</h1>
        <p className="sans mt-2 text-sm text-[#5c6773]">
          Under the new regime most Chapter VI-A deductions are not applied. 80C + 80CCC + 80CCD(1) share a ₹1.5 lakh ceiling.
          Self senior-citizen status is taken from date of birth (age on 31 Mar 2026).
        </p>
        <Card className="mt-6">
          <form action={saveDeductionsAction} className="space-y-3">
            <input type="hidden" name="returnId" value={id} />
            <Label>80C</Label>
            <Input name="80C" type="number" defaultValue={get("80C")} />
            <Label>80CCC</Label>
            <Input name="80CCC" type="number" defaultValue={get("80CCC")} />
            <Label>80CCD(1) employee NPS</Label>
            <Input name="80CCD(1)" type="number" defaultValue={get("80CCD(1)")} />
            <Label>80CCD(1B) additional NPS</Label>
            <Input name="80CCD(1B)" type="number" defaultValue={get("80CCD(1B)")} />
            <p className="font-medium pt-2">80D health insurance</p>
            <Label>Self / family premium</Label>
            <Input name="80D_SELF" type="number" defaultValue={get("80D_SELF")} />
            <Label>Self / family preventive check-up</Label>
            <Input name="80D_SELF_PREVENTIVE" type="number" defaultValue={get("80D_SELF_PREVENTIVE")} />
            <Label>Self medical expenditure (senior, no insurance only)</Label>
            <Input name="80D_SELF_MEDICAL" type="number" defaultValue={get("80D_SELF_MEDICAL")} />
            <Label>Parents premium</Label>
            <Input name="80D_PARENTS" type="number" defaultValue={get("80D_PARENTS")} />
            <Label>Parents preventive check-up</Label>
            <Input name="80D_PARENTS_PREVENTIVE" type="number" defaultValue={get("80D_PARENTS_PREVENTIVE")} />
            <Label>Parents medical expenditure (senior, no insurance only)</Label>
            <Input name="80D_PARENTS_MEDICAL" type="number" defaultValue={get("80D_PARENTS_MEDICAL")} />
            <label className="sans flex items-center gap-2 text-sm">
              <input type="checkbox" name="parentsSenior" value="Y" defaultChecked={parentsSenior} />
              Parents are senior citizens
            </label>
            <Label>80TTA savings interest</Label>
            <Input name="80TTA" type="number" defaultValue={get("80TTA")} />
            <Label>80TTB (senior citizens)</Label>
            <Input name="80TTB" type="number" defaultValue={get("80TTB")} />
            <Button>Save deductions</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
