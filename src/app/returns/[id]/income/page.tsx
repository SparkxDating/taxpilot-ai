import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ReturnNav } from "@/components/return-nav";
import { Button, Card, Input, Label } from "@/components/ui";
import { saveIncomeAction } from "@/app/actions";
import { json } from "@/lib/utils";
import { CODE_AD, CODE_ADA } from "@/lib/itr-json/ay2026_27/itr4/natureCodes";

export default async function IncomePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const ret = await prisma.taxReturn.findFirst({
    where: { id, userId: session.userId },
    include: { salary: true, business: true, professional: true, otherIncomes: true, houseProperties: true, profitLoss: true, balanceSheet: true },
  });
  if (!ret) notFound();
  const sources = json<string[]>(ret.incomeSourcesJson, []);
  const s = ret.salary[0];
  const b = ret.business[0];
  const p = ret.professional[0];
  const hp = ret.houseProperties[0];
  const interest = ret.otherIncomes.find((o) => o.kind === "Interest");
  return (
    <div>
      <SiteHeader authed name={session.name} />
      <div className="mx-auto max-w-2xl px-6 py-8">
        <ReturnNav id={id} current="income" />
        <h1 className="text-3xl">Income</h1>
        <form action={saveIncomeAction} className="mt-6 space-y-4">
          <input type="hidden" name="returnId" value={id} />
          <Card>
            <Label>Tax regime</Label>
            <select name="regime" defaultValue={ret.taxRegime} className="sans mt-1 w-full rounded-md border px-3 py-2 text-sm">
              <option value="NEW">New regime (default)</option>
              <option value="OLD">Old regime (Form 10-IEA required if you have business income)</option>
            </select>
          </Card>
          {sources.some((x) => x.includes("SALARY")) ? (
            <Card className="space-y-2">
              <p className="font-medium">Salary</p>
              <Input name="employerName" placeholder="Employer" defaultValue={s?.employerName} />
              <Input name="employerTan" placeholder="TAN" defaultValue={s?.employerTan} />
              <Input name="grossSalary" type="number" placeholder="Gross salary" defaultValue={s?.grossSalary || ""} />
              <Input name="salaryTds" type="number" placeholder="TDS on salary" defaultValue={s?.tds || ""} />
            </Card>
          ) : null}
          {sources.some((x) => ["BUSINESS", "FREELANCING"].includes(x)) ? (
            <Card className="space-y-2">
              <p className="font-medium">Presumptive business (44AD)</p>
              <Input name="nature" placeholder="Nature of business" defaultValue={b?.nature} />
              <select name="natureCode" defaultValue={b?.natureCode || ""} className="sans w-full rounded-md border px-3 py-2 text-sm">
                <option value="">Select official business code (CodeAD)</option>
                {CODE_AD.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <Input name="turnover" type="number" placeholder="Turnover" defaultValue={b?.turnover || ""} />
              <Input name="digitalReceipts" type="number" placeholder="Digital receipts" defaultValue={b?.digitalReceipts || ""} />
              <Input name="cashReceipts" type="number" placeholder="Cash receipts" defaultValue={b?.cashReceipts || ""} />
              <Input name="declaredBusiness" type="number" placeholder="Declared income (optional, min 6%/8%)" defaultValue={b?.declaredIncome || ""} />
            </Card>
          ) : null}
          {sources.some((x) => x.includes("PROFESSION")) ? (
            <Card className="space-y-2">
              <p className="font-medium">Presumptive profession (44ADA)</p>
              <Input name="profession" placeholder="Profession" defaultValue={p?.profession} />
              <select name="professionCode" defaultValue={p?.natureCode || ""} className="sans w-full rounded-md border px-3 py-2 text-sm">
                <option value="">Select official profession code (CodeADA)</option>
                {CODE_ADA.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <Input name="grossReceipts" type="number" placeholder="Gross receipts" defaultValue={p?.grossReceipts || ""} />
              <Input name="profCash" type="number" placeholder="Cash receipts" defaultValue={p?.cashReceipts || ""} />
              <Input name="declaredProfession" type="number" placeholder="Declared income (min 50%)" defaultValue={p?.declaredIncome || ""} />
            </Card>
          ) : null}
          {sources.some((x) => x.includes("HOUSE") || x.includes("PROPERTY")) ? (
            <Card className="space-y-2">
              <p className="font-medium">House property</p>
              <select name="hpOccupancy" defaultValue={hp?.occupancy || "SELF_OCCUPIED"} className="sans w-full rounded-md border px-3 py-2 text-sm">
                <option value="SELF_OCCUPIED">Self occupied</option>
                <option value="LET_OUT">Let out</option>
              </select>
              <Input name="hpAlv" type="number" placeholder="Annual lettable value" defaultValue={hp?.annualLetableValue || ""} />
              <Input name="hpMunicipal" type="number" placeholder="Municipal taxes" defaultValue={hp?.municipalTaxes || ""} />
              <Input name="hpInterest" type="number" placeholder="Interest on housing loan" defaultValue={hp?.interestOnLoan || ""} />
            </Card>
          ) : null}
          <Card className="space-y-2">
            <p className="font-medium">Other sources</p>
            <Input name="interest" type="number" placeholder="Interest income" defaultValue={interest?.amount || ""} />
            <Input name="interestSource" placeholder="Bank / source" defaultValue={interest?.source} />
            <Input name="dividend" type="number" placeholder="Dividend" />
          </Card>
          {ret.itrType === "ITR-3" ? (
            <Card>
              <p className="font-medium">ITR-3 books (architecture)</p>
              <p className="sans mt-2 text-sm text-[#5c6773]">
                P&amp;L and balance sheet models exist. Full ITR-3 mapping ships in a later phase. Enter revenue/expenses in a future build; this release keeps the tables ready.
              </p>
            </Card>
          ) : null}
          <Button>Save income</Button>
        </form>
      </div>
    </div>
  );
}
