import { SiteHeader } from "@/components/site-header";
import { Card, Button, Disclaimer } from "@/components/ui";
import Link from "next/link";

const FREE_FEATURES = [
  "Create ITR-4 return",
  "Upload documents",
  "Review extracted information",
  "Calculate tax",
  "Review return",
];

const PRO_FEATURES = [
  "Everything in Free",
  "Complete return export",
  "Final ITR-4 JSON",
  "Advanced automation",
];

export default function Pricing() {
  return (
    <div>
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-4xl">Pricing</h1>
        <p className="sans mt-3 text-[#5c6773]">
          Start on Free. Upgrade to Pro when you are ready to export your final ITR-4. Checkout is not connected in this
          release.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Card>
            <p className="sans text-xs uppercase tracking-widest text-[#c4a574]">FREE</p>
            <p className="mt-2 text-3xl">₹0</p>
            <ul className="sans mt-4 space-y-2 text-sm text-[#5c6773]">
              {FREE_FEATURES.map((item) => (
                <li key={item}>✓ {item}</li>
              ))}
            </ul>
            <Link href="/signup" className="mt-6 inline-block w-full sm:w-auto">
              <Button className="min-h-11 w-full sm:w-auto">Start on Free</Button>
            </Link>
          </Card>
          <Card>
            <p className="sans text-xs uppercase tracking-widest text-[#c4a574]">PRO</p>
            <p className="mt-2 text-3xl">Coming soon</p>
            <ul className="sans mt-4 space-y-2 text-sm text-[#5c6773]">
              {PRO_FEATURES.map((item) => (
                <li key={item}>✓ {item}</li>
              ))}
            </ul>
            <Button className="mt-6 min-h-11 w-full sm:w-auto" disabled>
              Checkout coming soon
            </Button>
          </Card>
        </div>
        <div className="mt-8">
          <Disclaimer />
        </div>
      </div>
    </div>
  );
}
