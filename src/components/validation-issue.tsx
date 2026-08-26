import Link from "next/link";
import { Badge, Button, Card } from "@/components/ui";
import { inr } from "@/lib/utils";

export function ValidationIssue({
  severity,
  title,
  message,
  suggestion,
  href,
  returnAmount,
  aisAmount,
}: {
  severity: "ERROR" | "WARNING" | "INFO";
  title: string;
  message: string;
  suggestion?: string;
  href?: string;
  returnAmount?: number;
  aisAmount?: number;
}) {
  const tone = severity === "ERROR" ? "err" : severity === "WARNING" ? "warn" : "muted";
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">
          {severity === "ERROR" ? "✕" : severity === "WARNING" ? "⚠" : "ℹ"} {title}
        </p>
        <Badge tone={tone}>{severity}</Badge>
      </div>
      <p className="sans mt-2 text-sm">{message}</p>
      {returnAmount != null && aisAmount != null ? (
        <ul className="sans mt-2 text-sm text-[#5c6773]">
          <li>Return: {inr(returnAmount)}</li>
          <li>AIS: {inr(aisAmount)}</li>
          <li>Difference: {inr(returnAmount - aisAmount)}</li>
        </ul>
      ) : null}
      {suggestion ? <p className="sans mt-1 text-sm text-[#5c6773]">{suggestion}</p> : null}
      {href ? (
        <Link href={href} className="mt-3 inline-block">
          <Button variant="outline">Review</Button>
        </Link>
      ) : null}
    </Card>
  );
}
