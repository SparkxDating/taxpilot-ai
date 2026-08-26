import { CRITICAL_INTERNAL_FIELDS, ITR4_MAPPING_REGISTRY } from "./mappingRegistry";

const ALLOWED_TYPES = new Set(["string", "number", "enum", "object", "array", "boolean"]);

export type MappingAudit = {
  status: "PASS" | "WARNING" | "ERROR";
  unmappedInternal: string[];
  duplicatePaths: string[];
  missingRequiredMappings: string[];
  typeMismatches: string[];
  invalidEnums: string[];
  unreachableMappings: string[];
};

export function auditITR4Mapping(): MappingAudit {
  const seenInternal = new Set<string>();
  const seenPath = new Map<string, number>();
  const duplicatePaths: string[] = [];
  for (const row of ITR4_MAPPING_REGISTRY) {
    seenInternal.add(row.internalField);
    seenPath.set(row.itrPath, (seenPath.get(row.itrPath) || 0) + 1);
  }
  for (const [p, n] of seenPath) {
    if (n > 1) duplicatePaths.push(p);
  }
  const unmappedInternal = CRITICAL_INTERNAL_FIELDS.filter((f) => !seenInternal.has(f));
  const required = ITR4_MAPPING_REGISTRY.filter((r) => r.required);
  const missingRequiredMappings = required.filter((r) => !r.itrPath.startsWith("ITR.ITR4.")).map((r) => r.internalField);
  const typeMismatches = ITR4_MAPPING_REGISTRY.filter((r) => !ALLOWED_TYPES.has(r.type)).map((r) => r.internalField);
  const invalidEnums = ITR4_MAPPING_REGISTRY.filter((r) => r.type === "enum" && !r.transformation).map((r) => r.internalField);
  const unreachableMappings = ITR4_MAPPING_REGISTRY.filter((r) => !r.itrPath.startsWith("ITR.ITR4.")).map((r) => r.internalField);
  const hasError =
    unmappedInternal.length ||
    duplicatePaths.length ||
    missingRequiredMappings.length ||
    typeMismatches.length ||
    invalidEnums.length ||
    unreachableMappings.length;
  const status: MappingAudit["status"] = hasError ? "ERROR" : "PASS";
  return {
    status,
    unmappedInternal,
    duplicatePaths,
    missingRequiredMappings,
    typeMismatches,
    invalidEnums,
    unreachableMappings,
  };
}
