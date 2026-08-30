import Link from "next/link";
import { Button, Card } from "./ui";
import { PRICING_PATH, UPGRADE_DETAIL, UPGRADE_HEADING } from "@/lib/plan";

export function UpgradeCta({ className }: { className?: string }) {
  return (
    <Link href={PRICING_PATH} className={className}>
      <Button className="min-h-11 w-full sm:w-auto" aria-label="Upgrade to Pro">
        Upgrade to Pro
      </Button>
    </Link>
  );
}

export function ProUpgradeCard() {
  return (
    <Card className="mt-6">
      <p className="font-medium">{UPGRADE_HEADING}</p>
      <p className="sans mt-2 text-sm text-[#5c6773]">{UPGRADE_DETAIL}</p>
      <UpgradeCta className="mt-4 inline-block w-full sm:w-auto" />
    </Card>
  );
}
