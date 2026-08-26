import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ReturnNav } from "@/components/return-nav";
import { Button, Card, Input, Label } from "@/components/ui";
import { saveProfileAction } from "@/app/actions";

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const ret = await prisma.taxReturn.findFirst({ where: { id, userId: session.userId } });
  if (!ret) notFound();
  const profile = await prisma.profile.findUnique({ where: { userId: session.userId } });
  return (
    <div>
      <SiteHeader authed name={session.name} />
      <div className="mx-auto max-w-2xl px-6 py-8">
        <ReturnNav id={id} current="profile" />
        <h1 className="text-3xl">Personal information</h1>
        <Card className="mt-6">
          <form action={saveProfileAction} className="grid gap-3">
            <input type="hidden" name="returnId" value={id} />
            <div>
              <Label>Name as per PAN</Label>
              <Input name="name" defaultValue={session.name} required />
            </div>
            <div>
              <Label>PAN</Label>
              <Input name="pan" defaultValue={profile?.pan} placeholder="AAAAA9999A" required />
            </div>
            <div>
              <Label>Father&apos;s name</Label>
              <Input name="fatherName" defaultValue={profile?.fatherName} required />
            </div>
            <div>
              <Label>Date of birth</Label>
              <Input name="dateOfBirth" type="date" defaultValue={profile?.dateOfBirth?.toISOString().slice(0, 10)} required />
            </div>
            <div>
              <Label>Residential status</Label>
              <select name="residentialStatus" defaultValue={profile?.residentialStatus || ""} required className="sans w-full rounded-md border border-[#d7cfc0] px-3 py-2 text-sm">
                <option value="">Select residential status</option>
                <option value="RESIDENT">Resident</option>
                <option value="RNOR">RNOR (not eligible for ITR-4 JSON)</option>
                <option value="NRI">NRI (not eligible for ITR-4 JSON)</option>
              </select>
            </div>
            <div>
              <Label>Phone</Label>
              <Input name="phone" defaultValue={profile?.phone} required />
            </div>
            <div>
              <Label>Address</Label>
              <Input name="address" defaultValue={profile?.addressLine1} required />
            </div>
            <div>
              <Label>Locality / area</Label>
              <Input name="locality" defaultValue={profile?.addressLine2} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input name="city" placeholder="City" defaultValue={profile?.city} required />
              <Input name="state" placeholder="State" defaultValue={profile?.state} required />
              <Input name="pincode" placeholder="PIN" defaultValue={profile?.pincode} required />
            </div>
            <Button>Save and continue</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
