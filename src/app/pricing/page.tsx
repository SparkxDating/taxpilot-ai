import { SiteHeader } from "@/components/site-header";
import { Card, Button, Disclaimer } from "@/components/ui";
import Link from "next/link";

export default function Pricing() {
  const plans = [
    ["FREE", "Draft a return, see eligibility, run calculations", "₹0"],
    ["ITR4", "Full ITR-4 JSON generation for one AY", "Payment provider not connected"],
    ["ITR3", "ITR-3 schedules (architecture in this release)", "Payment provider not connected"],
    ["PROFESSIONAL", "Multiple clients as a tax professional", "Payment provider not connected"],
    ["CA_FIRM", "Firm workspace", "Payment provider not connected"],
  ];
  return (
    <div>
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-4xl">Pricing</h1>
        <p className="sans mt-3 text-[#5c6773]">Plans exist in the product. Checkout is not connected in this release.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {plans.map(([n, d, p]) => (
            <Card key={n}>
              <p className="sans text-xs uppercase tracking-widest text-[#c4a574]">{n}</p>
              <p className="mt-2 text-xl">{d}</p>
              <p className="sans mt-3 text-sm text-[#5c6773]">{p}</p>
            </Card>
          ))}
        </div>
        <Link href="/signup" className="mt-8 inline-block">
          <Button>Start on Free</Button>
        </Link>
        <div className="mt-8">
          <Disclaimer />
        </div>
      </div>
    </div>
  );
}
