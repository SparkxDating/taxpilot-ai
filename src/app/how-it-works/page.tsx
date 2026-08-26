import { SiteHeader } from "@/components/site-header";
import { Card, Disclaimer } from "@/components/ui";

export default function How() {
  const steps = [
    "Create an account and a return for AY 2026–27",
    "Tell us your taxpayer type and income sources",
    "A rules engine recommends ITR-4 or ITR-3",
    "Answer only the relevant interview questions",
    "Enter income, deductions, TDS and bank details",
    "Optionally upload Form 16, AIS, 26AS and statements",
    "Review calculations and validation",
    "Generate ITR JSON and download it",
    "Upload the JSON on the Income Tax e-filing portal",
  ];
  return (
    <div>
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl">How it works</h1>
        <ol className="mt-8 space-y-3">
          {steps.map((s, i) => (
            <Card key={s} className="flex gap-4">
              <span className="sans text-sm text-[#c4a574]">{String(i + 1).padStart(2, "0")}</span>
              <p>{s}</p>
            </Card>
          ))}
        </ol>
        <p className="mt-8 text-sm text-[#5c6773]">
          TaxPilot AI does not log in to the Income Tax portal and never stores portal credentials.
        </p>
        <div className="mt-6">
          <Disclaimer />
        </div>
      </div>
    </div>
  );
}
