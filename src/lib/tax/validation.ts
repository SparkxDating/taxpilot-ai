import type { NormalizedReturn } from "./model";
import { businessValidate, type BusinessIssue } from "@/lib/validation/businessRules";
import { completenessValidate } from "@/lib/validation/completeness";
import { detectUnsupported } from "@/lib/itr-rules/ay2026_27/unsupported";
import { validateITR4Json } from "@/lib/itr-json/validator/officialValidator";
import { generateITRJson } from "@/lib/itr-json/mapper";

export type Issue = {
  level: 1 | 2 | 3;
  severity: "ERROR" | "WARNING" | "INFO";
  section: string;
  field: string;
  message: string;
  suggestion: string;
  href: string;
  id?: string;
};

function toIssue(b: BusinessIssue): Issue {
  return {
    id: b.id,
    level: b.severity === "ERROR" ? 2 : 1,
    severity: b.severity,
    section: b.section,
    field: b.field,
    message: b.message,
    suggestion: b.explanation,
    href: b.fixRoute,
  };
}

export function validateReturn(data: NormalizedReturn, returnId?: string) {
  const completeness = completenessValidate(data, returnId).map(toIssue);
  const business = businessValidate(data, returnId).map(toIssue);
  const unsupported = detectUnsupported(data, returnId).map((u) => ({
    id: u.code,
    level: 2 as const,
    severity: u.severity,
    section: "Unsupported scenario",
    field: u.code,
    message: u.message,
    suggestion: "Do not generate filing JSON until this scenario is supported or removed.",
    href: u.fixRoute,
  }));
  const issues = [...completeness, ...business, ...unsupported];
  const seen = new Set<string>();
  const deduped = issues.filter((i) => {
    const k = `${i.field}:${i.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { issues: deduped, level1: deduped.filter((i) => i.level === 1), level2: deduped.filter((i) => i.level === 2) };
}

export function validateAgainstOfficialSchema(json: unknown, assessmentYear: string, itrType: string) {
  if (itrType !== "ITR-4") {
    return {
      valid: false,
      errors: [
        {
          level: 3 as const,
          severity: "ERROR" as const,
          section: "Official JSON schema",
          field: "itrType",
          message: "ITR-3 filing JSON is disabled.",
          suggestion: "Use ITR-4 or wait for ITR-3.",
          href: "",
        },
      ],
      warnings: [],
    };
  }
  const r = validateITR4Json(json, assessmentYear);
  return {
    valid: r.valid,
    errors: r.errors.map((e) => ({
      level: 3 as const,
      severity: "ERROR" as const,
      section: "Official JSON schema",
      field: e.field,
      message: e.explanation,
      suggestion: `${e.path} (${e.keyword})`,
      href: "",
    })),
    warnings: [],
  };
}

export function fullValidate(data: NormalizedReturn, returnId?: string) {
  const business = validateReturn(data, returnId);
  const generated = generateITRJson(data, { returnId });
  return { business, generated };
}
