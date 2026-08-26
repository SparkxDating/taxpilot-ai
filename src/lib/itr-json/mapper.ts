import { createHash } from "crypto";
import type { NormalizedReturn } from "@/lib/tax/model";
import { OFFICIAL_SCHEMA_VER } from "@/lib/itr-json/ay2026_27/itr4/mapper";
import { evaluateFilingGate } from "@/lib/validation/filingGate";
import type { TaxComputation } from "@/lib/tax/engine";
import { TaxEngine } from "@/lib/tax/engine";

export const SCHEMA_VERSION = OFFICIAL_SCHEMA_VER;

export type GeneratedItr = {
  json: unknown;
  digest: string;
  calc: TaxComputation;
  schemaVersion: string;
  valid: boolean;
  errors: Array<{ severity: string; message: string; field?: string; path?: string; explanation?: string; fixRoute?: string }>;
  warnings: Array<{ severity: string; message: string; field?: string }>;
  official: ReturnType<typeof evaluateFilingGate>["official"];
  blocked: boolean;
  layers: ReturnType<typeof evaluateFilingGate>["layers"];
};

export function generateITRJson(data: NormalizedReturn, opts?: { generatedAt?: Date; returnId?: string }): GeneratedItr {
  const calc = TaxEngine.calculate(data);
  const gate = evaluateFilingGate(data, opts?.returnId, opts?.generatedAt);
  const errors: GeneratedItr["errors"] = [];
  if (!gate.integrity.ok) {
    errors.push({
      severity: "ERROR",
      message: "Official AY 2026–27 ITR-4 schema integrity verification failed. JSON generation is disabled.",
      field: "schema",
    });
  }
  for (const c of gate.completeness) {
    errors.push({ severity: c.severity, message: c.message, field: c.field, explanation: c.explanation, fixRoute: c.fixRoute });
  }
  for (const u of gate.unsupported) {
    errors.push({ severity: u.severity, message: u.message, field: u.code, fixRoute: u.fixRoute });
  }
  for (const b of gate.business.filter((x) => x.severity === "ERROR")) {
    errors.push({ severity: b.severity, message: b.message, field: b.field, explanation: b.explanation, fixRoute: b.fixRoute });
  }
  for (const e of gate.official.errors) {
    errors.push({ severity: "ERROR", message: e.explanation, field: e.field, path: e.path, explanation: e.message });
  }
  const warnings = gate.business.filter((b) => b.severity !== "ERROR").map((b) => ({ severity: b.severity, message: b.message, field: b.field }));
  const digest = gate.json ? createHash("sha256").update(JSON.stringify(gate.json)).digest("hex") : "";
  return {
    json: gate.ready ? gate.json : null,
    digest,
    calc: gate.calc || calc,
    schemaVersion: gate.official.schemaVersion || SCHEMA_VERSION,
    valid: gate.ready,
    blocked: !gate.ready,
    errors,
    warnings,
    official: gate.official,
    layers: gate.layers,
  };
}

export function mapToOfficialJson(data: NormalizedReturn) {
  const gate = evaluateFilingGate(data, undefined, undefined);
  return { json: gate.json, calc: gate.calc };
}
