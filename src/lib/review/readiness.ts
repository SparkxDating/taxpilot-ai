import type { JsonGenerationGate } from "@/lib/itr-json/mapper";

export type ReadinessStatus = "READY" | "NOT_READY";
export type ChecklistStatus = "COMPLETE" | "NEEDS REVIEW" | "BLOCKED";

export type ReadinessReason = {
  title: string;
  detail: string;
  href?: string;
};

export type ReviewChecklistItem = {
  label: string;
  status: ChecklistStatus;
  href?: string;
};

function hrefFor(returnId: string | undefined, slug: string) {
  return returnId ? `/returns/${returnId}/${slug}` : undefined;
}

function collectReasons(gate: JsonGenerationGate, returnId?: string, openConflicts = 0): ReadinessReason[] {
  const reasons: ReadinessReason[] = [];
  const layers = gate.result?.layers;
  const errors = gate.result?.errors || [];
  const has = (field: string) => errors.some((e) => e.field === field);
  const first = (...fields: string[]) => errors.find((e) => e.field && fields.includes(e.field));

  if (gate.error === "itr3") {
    reasons.push({ title: "ITR-3 path", detail: "ITR-3 JSON generation is not available yet.", href: hrefFor(returnId, "interview") });
  }
  if (gate.error === "empty") {
    reasons.push({ title: "Required information missing", detail: "Return data could not be loaded." });
  }
  if (openConflicts > 0 || has("DOCUMENT_CONFLICT_OPEN")) {
    reasons.push({
      title: "Unresolved document conflict",
      detail: "JSON generation stays blocked until conflicts are resolved.",
      href: hrefFor(returnId, "documents"),
    });
  }
  if (layers?.dataCompleteness === "FAIL") {
    const row = first("pan", "dateOfBirth", "name", "ifsc", "accountNumber") || errors.find((e) => e.fixRoute);
    reasons.push({
      title: "Required information missing",
      detail: row?.message || "Complete required return information before generating JSON.",
      href: row?.fixRoute || hrefFor(returnId, "profile"),
    });
  }
  if (layers?.taxCalculation === "FAIL") {
    reasons.push({
      title: "Tax validation failed",
      detail: errors.find((e) => e.field?.startsWith("UNSUPPORTED") || e.field === "tax")?.message || "The tax engine flagged an invalid or unsupported calculation.",
      href: hrefFor(returnId, "validate"),
    });
  }
  if (layers?.businessRules === "FAIL" || layers?.unsupported === "FAIL") {
    reasons.push({
      title: "Return validation failed",
      detail: errors.find((e) => e.severity === "ERROR")?.message || "Return validation did not pass.",
      href: hrefFor(returnId, "validate"),
    });
  }
  if (layers?.schema === "FAIL" || layers?.schemaIntegrity === "FAIL" || has("OFFICIAL_SCHEMA_INTEGRITY_FAILURE")) {
    reasons.push({
      title: "Schema validation failed",
      detail: "Official ITR-4 schema validation did not pass.",
      href: hrefFor(returnId, "json"),
    });
  }
  if (layers?.eligibility === "FAIL") {
    reasons.push({
      title: "ITR-4 eligibility",
      detail: "This return is not eligible for ITR-4 JSON.",
      href: hrefFor(returnId, "interview"),
    });
  }
  if (!reasons.length) {
    for (const e of errors.filter((x) => x.severity === "ERROR").slice(0, 6)) {
      reasons.push({ title: "Action required", detail: e.message, href: e.fixRoute || hrefFor(returnId, "validate") });
    }
  }
  if (!reasons.length) {
    reasons.push({
      title: "Action required",
      detail: "The filing gate blocked JSON generation.",
      href: hrefFor(returnId, "validate"),
    });
  }
  return reasons;
}

function checklist(gate: JsonGenerationGate, returnId?: string, openConflicts = 0): ReviewChecklistItem[] {
  const layers = gate.result?.layers;
  const fail = (layer?: "PASS" | "FAIL") => (layer === "FAIL" ? "BLOCKED" : "COMPLETE") as ChecklistStatus;
  return [
    { label: "Personal information", status: fail(layers?.dataCompleteness), href: hrefFor(returnId, "profile") },
    { label: "Income", status: fail(layers?.businessRules), href: hrefFor(returnId, "income") },
    { label: "Deductions", status: "COMPLETE", href: hrefFor(returnId, "deductions") },
    { label: "TDS", status: "COMPLETE", href: hrefFor(returnId, "tds") },
    { label: "Conflicts", status: openConflicts > 0 ? "BLOCKED" : "COMPLETE", href: hrefFor(returnId, "documents") },
    { label: "Tax calculation", status: fail(layers?.taxCalculation), href: hrefFor(returnId, "summary") },
    { label: "Final validation", status: gate.allowed ? "COMPLETE" : "BLOCKED", href: hrefFor(returnId, "json") },
  ];
}

/** UI readiness is a view of canGenerateItrJson(). It never overrides gate.allowed. */
export function reviewReadiness(
  gate: JsonGenerationGate,
  opts?: { returnId?: string; openConflicts?: number },
) {
  const openConflicts = opts?.openConflicts ?? 0;
  if (gate.allowed) {
    return { status: "READY" as const, reasons: [] as ReadinessReason[], checklist: checklist(gate, opts?.returnId, openConflicts) };
  }
  return {
    status: "NOT_READY" as const,
    reasons: collectReasons(gate, opts?.returnId, openConflicts),
    checklist: checklist(gate, opts?.returnId, openConflicts),
  };
}
