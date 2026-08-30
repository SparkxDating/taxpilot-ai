import type { JsonGenerationGate } from "@/lib/itr-json/mapper";

export type ReadinessStatus = "READY" | "NOT_READY";
export type ChecklistStatus = "COMPLETE" | "NEEDS REVIEW" | "BLOCKED";

export type ReadinessReason = {
  title: string;
  detail: string;
  href?: string;
  severity?: "BLOCKING" | "WARNING";
  section?: string;
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
  const blocking = (title: string, detail: string, href?: string, section?: string) => {
    reasons.push({ title, detail, href, section, severity: "BLOCKING" });
  };

  if (gate.error === "itr3") {
    blocking("ITR-3 path", "ITR-3 JSON generation is not available yet.", hrefFor(returnId, "interview"), "Eligibility");
  }
  if (gate.error === "empty") {
    blocking("Required information missing", "Return data could not be loaded.");
  }
  if (openConflicts > 0 || has("DOCUMENT_CONFLICT_OPEN")) {
    blocking(
      "Unresolved document conflict",
      "JSON generation stays blocked until conflicts are resolved.",
      hrefFor(returnId, "documents"),
      "Conflicts",
    );
  }
  if (layers?.dataCompleteness === "FAIL") {
    const row = first("pan", "dateOfBirth", "name", "ifsc", "accountNumber") || errors.find((e) => e.fixRoute);
    blocking(
      "Required information missing",
      row?.message || "Complete required return information before generating JSON.",
      row?.fixRoute || hrefFor(returnId, "profile"),
      "Personal information",
    );
  }
  if (layers?.taxCalculation === "FAIL") {
    blocking(
      "Tax validation failed",
      errors.find((e) => e.field?.startsWith("UNSUPPORTED") || e.field === "tax")?.message || "The tax engine flagged an invalid or unsupported calculation.",
      hrefFor(returnId, "validate"),
    );
  }
  if (layers?.businessRules === "FAIL" || layers?.unsupported === "FAIL") {
    blocking(
      "Return validation failed",
      errors.find((e) => e.severity === "ERROR")?.message || "Return validation did not pass.",
      hrefFor(returnId, "validate"),
    );
  }
  if (layers?.schema === "FAIL" || layers?.schemaIntegrity === "FAIL" || has("OFFICIAL_SCHEMA_INTEGRITY_FAILURE")) {
    blocking("Schema validation failed", "Official ITR-4 schema validation did not pass.", hrefFor(returnId, "json"), "Schema");
  }
  if (layers?.eligibility === "FAIL") {
    blocking("ITR-4 eligibility", "This return is not eligible for ITR-4 JSON.", hrefFor(returnId, "interview"), "Eligibility");
  }

  const seen = new Set(reasons.map((r) => r.detail));
  for (const e of errors.filter((x) => x.severity === "ERROR").slice(0, 8)) {
    if (!e.message || seen.has(e.message)) continue;
    seen.add(e.message);
    blocking("BLOCKING", e.message, e.fixRoute || hrefFor(returnId, "validate"), e.section);
  }

  if (!reasons.length) {
    blocking("Action required", "The filing gate blocked JSON generation.", hrefFor(returnId, "validate"));
  }
  return reasons;
}

function checklist(gate: JsonGenerationGate, returnId?: string, openConflicts = 0): ReviewChecklistItem[] {
  const layers = gate.result?.layers;
  const errors = gate.result?.errors || [];
  const fail = (layer?: "PASS" | "FAIL") => (layer === "FAIL" ? "BLOCKED" : "COMPLETE") as ChecklistStatus;
  const sectionBlocked = (name: string) =>
    errors.some((e) => e.severity === "ERROR" && (e.section === name || e.field?.toLowerCase().includes(name.toLowerCase())));
  return [
    { label: "Personal information", status: fail(layers?.dataCompleteness), href: hrefFor(returnId, "profile") },
    { label: "Income", status: fail(layers?.businessRules), href: hrefFor(returnId, "income") },
    { label: "Deductions", status: sectionBlocked("Deductions") ? "BLOCKED" : "COMPLETE", href: hrefFor(returnId, "deductions") },
    { label: "TDS", status: sectionBlocked("TDS") || sectionBlocked("Tax payments") ? "BLOCKED" : "COMPLETE", href: hrefFor(returnId, "tds") },
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
  const warnings = (gate.result?.warnings || []).map((w) => ({
    title: "WARNING" as const,
    detail: w.message,
    section: w.section,
    severity: "WARNING" as const,
    href: opts?.returnId ? `/returns/${opts.returnId}/validate` : undefined,
  }));
  if (gate.allowed) {
    return {
      status: "READY" as const,
      reasons: [] as ReadinessReason[],
      warnings,
      checklist: checklist(gate, opts?.returnId, openConflicts),
    };
  }
  return {
    status: "NOT_READY" as const,
    reasons: collectReasons(gate, opts?.returnId, openConflicts),
    warnings,
    checklist: checklist(gate, opts?.returnId, openConflicts),
  };
}
