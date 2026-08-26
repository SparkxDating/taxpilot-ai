import Link from "next/link";
import { cn } from "@/lib/utils";

const steps = [
  ["interview", "Interview"],
  ["profile", "Personal"],
  ["income", "Income"],
  ["deductions", "Deductions"],
  ["tds", "TDS & bank"],
  ["documents", "Documents"],
  ["reconcile", "AIS"],
  ["validate", "Checks"],
  ["summary", "Summary"],
];

export function ReturnNav({ id, current }: { id: string; current: string }) {
  return (
    <ol className="sans mb-8 flex flex-wrap gap-2 text-xs">
      {steps.map(([slug, label]) => (
        <li key={slug}>
          <Link
            href={`/returns/${id}/${slug}`}
            className={cn(
              "rounded-full px-3 py-1",
              current === slug ? "bg-[#1f4e46] text-white" : "bg-[#efe8da] text-[#5c6773]",
            )}
          >
            {label}
          </Link>
        </li>
      ))}
    </ol>
  );
}
