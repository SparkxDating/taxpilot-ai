import Ajv from "ajv-draft-04";
/** Production AJV compiles the official AY 2026-27 ITR-4 schema only. */
import officialSchema from "@/lib/itr-json/schemas/ay2026_27/itr4/schema.json";
import metadata from "@/lib/itr-json/schemas/ay2026_27/itr4/metadata.json";
import { formatAjvError } from "./errorFormatter";
import type { OfficialValidationResult } from "./validationTypes";
import { verifySchemaIntegrity } from "@/lib/itr-json/schemaIntegrity";

const ajv = new Ajv({
  allErrors: true,
  strict: false,
  validateFormats: false,
});

const validate = ajv.compile(officialSchema as object);

export function validateITR4Json(json: unknown, assessmentYear: string): OfficialValidationResult {
  const integrity = verifySchemaIntegrity();
  if (!integrity.ok) {
    return {
      valid: false,
      schemaVersion: metadata.schemaVersion,
      schemaMode: "OfficialSchema",
      errors: [
        {
          path: "/",
          field: "schema",
          keyword: "integrity",
          message: integrity.message,
          explanation: "The official AY 2026–27 ITR-4 schema could not be verified. JSON generation has been disabled.",
        },
      ],
      warnings: [],
    };
  }
  if (assessmentYear !== "2026-27") {
    return {
      valid: false,
      schemaVersion: metadata.schemaVersion,
      schemaMode: "OfficialSchema",
      errors: [
        {
          path: "/",
          field: "assessmentYear",
          keyword: "const",
          message: `No official ITR-4 schema for AY ${assessmentYear}`,
          explanation: "Only AY 2026-27 official ITR-4 schema is installed.",
        },
      ],
      warnings: [],
    };
  }
  const ok = validate(json) as boolean;
  const errors = (validate.errors || []).map(formatAjvError);
  return {
    valid: ok && errors.length === 0,
    errors,
    warnings: [],
    schemaVersion: metadata.schemaVersion,
    schemaMode: "OfficialSchema",
  };
}
