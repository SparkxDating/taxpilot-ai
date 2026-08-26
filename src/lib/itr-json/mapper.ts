import { createHash } from "crypto";
import type { NormalizedReturn } from "@/lib/tax/model";
import { mapItr4Official, OFFICIAL_SCHEMA_VER } from "@/lib/itr-json/ay2026_27/itr4/mapper";
import { validateITR4Json } from "@/lib/itr-json/validator/officialValidator";
import { businessValidate, canGenerateJson } from "@/lib/validation/businessRules";
import type { TaxComputation } from "@/lib/tax/engine";

export const SCHEMA_VERSION = OFFICIAL_SCHEMA_VER;

export type GeneratedItr = {
  json: unknown;
  digest: string;
  calc: TaxComputation;
  schemaVersion: string;
  valid: boolean;
  errors: Array<{ severity: string; message: string; field?: string; path?: string; explanation?: string; fixRoute?: string }>;
  warnings: Array<{ severity: string; message: string; field?: string }>;
  official: ReturnType<typeof validateITR4Json>;
  blocked: boolean;
};

export function generateITRJson(data: NormalizedReturn, opts?: { generatedAt?: Date; returnId?: string }): GeneratedItr {
  if (data.itrType !== "ITR-4") {
    return {
      json: null,
      digest: "",
      calc: mapItr4Official({ ...data, itrType: "ITR-4" }, opts?.generatedAt).calc,
      schemaVersion: SCHEMA_VERSION,
      valid: false,
      blocked: true,
      official: { valid: false, errors: [], warnings: [], schemaVersion: SCHEMA_VERSION, schemaMode: "OfficialSchema" },
      errors: [
        {
          severity: "ERROR",
          message: "ITR-3 preparation is currently in development. Filing JSON generation is not available yet.",
          field: "itrType",
        },
      ],
      warnings: [],
    };
  }
  const business = businessValidate(data, opts?.returnId);
  const { json, calc } = mapItr4Official(data, opts?.generatedAt);
  const official = validateITR4Json(json, data.assessmentYear);
  const digest = createHash("sha256").update(JSON.stringify(json)).digest("hex");
  const errors = [
    ...business.filter((b) => b.severity === "ERROR").map((b) => ({
      severity: b.severity,
      message: b.message,
      field: b.field,
      explanation: b.explanation,
      fixRoute: b.fixRoute,
    })),
    ...official.errors.map((e) => ({
      severity: "ERROR",
      message: e.explanation,
      field: e.field,
      path: e.path,
      explanation: e.message,
    })),
  ];
  const warnings = business.filter((b) => b.severity !== "ERROR").map((b) => ({ severity: b.severity, message: b.message, field: b.field }));
  const valid = canGenerateJson(business) && official.valid;
  return {
    json,
    digest,
    calc,
    schemaVersion: official.schemaVersion,
    valid,
    blocked: !valid,
    errors,
    warnings,
    official,
  };
}

/** @deprecated adapter mapping removed from production. */
export function mapToOfficialJson(data: NormalizedReturn) {
  return mapItr4Official(data);
}
