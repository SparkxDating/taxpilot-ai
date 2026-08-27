import { Badge, Card } from "@/components/ui";
import type { PrefillEntry, SectionStatus } from "@/lib/documents/prefill";

export function PrepareSummary({
  documents,
  verifiedFacts,
  needsReview,
  conflicts,
  importedValues,
  sections,
}: {
  documents: number;
  verifiedFacts: number;
  needsReview: number;
  conflicts: number;
  importedValues: number;
  sections?: Array<{ label: string; href: string; status: SectionStatus }>;
}) {
  const tone = (s: SectionStatus) => (s === "COMPLETE" ? "ok" : s === "CONFLICT" ? "err" : "warn");
  return (
    <Card className="space-y-2">
      <p className="font-medium">Document import</p>
      <p className="sans text-sm text-[#5c6773]">
        Documents {documents} processed · Verified facts {verifiedFacts} · Needs review {needsReview} · Conflicts {conflicts} ·
        Imported values {importedValues}
      </p>
      {sections?.length ? (
        <ul className="sans mt-2 flex flex-wrap gap-2 text-xs">
          {sections.map((s) => (
            <li key={s.label}>
              <a href={s.href} className="inline-flex items-center gap-1">
                {s.label} <Badge tone={tone(s.status)}>{s.status}</Badge>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

export function PrefillNote({
  entry,
  field,
}: {
  entry?: PrefillEntry;
  returnId?: string;
  field: string;
}) {
  if (!entry) return <p className="sans text-xs text-[#5c6773]">Source: USER_INPUT if you type a value.</p>;
  const page = entry.sourcePage ? ` · Page ${entry.sourcePage}` : "";
  if (entry.origin === "IMPORTED") {
    return (
      <p className="sans text-xs text-[#5c6773]">
        ✓ Imported from verified {entry.source.replaceAll("_", " ")}
        {page} · Verified
      </p>
    );
  }
  if (entry.origin === "USER_EDITED") {
    return (
      <div className="sans text-xs text-[#5c6773]">
        <p>
          User edited · original {entry.source.replaceAll("_", " ")} {entry.originalValue}
          {page}
        </p>
        <button type="submit" form={`reset-${field}`} className="mt-1 text-[#1f4e46] underline">
          Reset to imported value
        </button>
      </div>
    );
  }
  return <p className="sans text-xs text-[#5c6773]">Source: USER_INPUT</p>;
}
