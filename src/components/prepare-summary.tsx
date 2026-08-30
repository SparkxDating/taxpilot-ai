import { Badge, Card } from "@/components/ui";
import type { PrefillEntry, SectionStatus } from "@/lib/documents/prefill";
import { inr } from "@/lib/utils";

export function PrepareSummary({
  documents,
  verifiedFacts,
  needsReview,
  conflicts,
  importedValues,
  sections,
  imports,
}: {
  documents: number;
  verifiedFacts: number;
  needsReview: number;
  conflicts: number;
  importedValues: number;
  sections?: Array<{ label: string; href: string; status: SectionStatus }>;
  imports?: Array<{ source: string; items: string[] }>;
}) {
  const tone = (s: SectionStatus) => (s === "COMPLETE" ? "ok" : s === "CONFLICT" ? "err" : "warn");
  return (
    <Card className="space-y-2">
      <p className="font-medium">Document import</p>
      <p className="sans text-sm text-[#5c6773]">
        Documents {documents} processed · Verified facts {verifiedFacts} · Needs review {needsReview} · Conflicts {conflicts} ·
        Imported values {importedValues}
      </p>
      {importedValues > 0 ? (
        <p className="sans text-xs text-[#5c6773]">Imported automatically from verified documents</p>
      ) : null}
      {imports?.length ? (
        <ul className="sans mt-1 space-y-1 text-xs text-[#5c6773]">
          {imports.map((row) => (
            <li key={row.source}>
              {row.source}
              {row.items.map((item) => (
                <span key={item} className="block pl-3">
                  ✓ {item}
                </span>
              ))}
            </li>
          ))}
        </ul>
      ) : null}
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

function prettySource(raw: string) {
  if (raw === "FORM_16") return "Form 16";
  if (raw === "BANK_STATEMENT") return "Bank statement";
  if (raw === "USER_INPUT") return "Manual entry";
  return raw.replaceAll("_", " ");
}

function displayValue(value: string) {
  if (/^-?\d+$/.test(value.trim())) return inr(Number(value));
  return value;
}

function sourceLine(entry: PrefillEntry) {
  const label = prettySource(entry.sourceDocumentType || entry.source);
  const page = entry.sourcePage ? ` · Page ${entry.sourcePage}` : "";
  return `${label}${page}`;
}

export function PrefillNote({
  entry,
  field,
}: {
  entry?: PrefillEntry;
  returnId?: string;
  field: string;
}) {
  if (!entry) return null;
  if (entry.origin === "IMPORTED") {
    return (
      <div className="sans text-xs text-[#5c6773]">
        <p>Imported automatically from verified documents</p>
        <p>Imported from {sourceLine(entry)}</p>
      </div>
    );
  }
  if (entry.origin === "USER_EDITED") {
    return (
      <div className="sans text-xs text-[#5c6773]">
        <p>Current: {displayValue(entry.currentValue)}</p>
        <p>Imported: {displayValue(entry.originalValue)}</p>
        <p>Source: {sourceLine(entry)}</p>
        <button type="submit" form={`reset-${field}`} className="mt-1 text-[#1f4e46] underline">
          Reset to imported value
        </button>
      </div>
    );
  }
  return <p className="sans text-xs text-[#5c6773]">Source: Manual entry</p>;
}