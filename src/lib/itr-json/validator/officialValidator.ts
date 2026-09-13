import Ajv from "ajv-draft-04";
import type { ValidateFunction } from "ajv";
import officialItr4Schema from "@/lib/itr-json/schemas/ay2026_27/itr4/schema.json";
import officialItr3Schema from "@/lib/itr-json/schemas/ay2026_27/itr3/schema.json";
import itr4Metadata from "@/lib/itr-json/schemas/ay2026_27/itr4/metadata.json";
import itr3Metadata from "@/lib/itr-json/schemas/ay2026_27/itr3/metadata.json";
import { formatAjvError } from "./errorFormatter";
import type { OfficialValidationResult } from "./validationTypes";
import { verifyItr3SchemaIntegrity, verifySchemaIntegrity } from "@/lib/itr-json/schemaIntegrity";

const ajv4 = new Ajv({
  allErrors: true,
  strict: false,
  validateFormats: false,
});

const validateItr4 = ajv4.compile(officialItr4Schema as object);

let validateItr3: ValidateFunction | null = null;

function getItr3Validate(): ValidateFunction {
  if (!validateItr3) {
    const ajv3 = new Ajv({
      allErrors: true,
      strict: false,
      validateFormats: false,
    });
    validateItr3 = ajv3.compile(officialItr3Schema as object);
  }
  return validateItr3;
}

export function validateITR4Json(json: unknown, assessmentYear: string): OfficialValidationResult {
  const integrity = verifySchemaIntegrity();
  if (!integrity.ok) {
    return {
      valid: false,
      schemaVersion: itr4Metadata.schemaVersion,
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
      schemaVersion: itr4Metadata.schemaVersion,
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
  const ok = validateItr4(json) as boolean;
  const errors = (validateItr4.errors || []).map((e) => formatAjvError(e, "ITR-4"));
  return {
    valid: ok && errors.length === 0,
    errors,
    warnings: [],
    schemaVersion: itr4Metadata.schemaVersion,
    schemaMode: "OfficialSchema",
  };
}

export function validateITR3Json(json: unknown, assessmentYear: string): OfficialValidationResult {
  const integrity = verifyItr3SchemaIntegrity();
  if (!integrity.ok) {
    return {
      valid: false,
      schemaVersion: itr3Metadata.schemaVersion,
      schemaMode: "OfficialSchema",
      errors: [
        {
          path: "/",
          field: "schema",
          keyword: "integrity",
          message: integrity.message,
          explanation: "The official AY 2026–27 ITR-3 schema could not be verified. JSON generation has been disabled.",
        },
      ],
      warnings: [],
    };
  }
  if (assessmentYear !== "2026-27") {
    return {
      valid: false,
      schemaVersion: itr3Metadata.schemaVersion,
      schemaMode: "OfficialSchema",
      errors: [
        {
          path: "/",
          field: "assessmentYear",
          keyword: "const",
          message: `No official ITR-3 schema for AY ${assessmentYear}`,
          explanation: "Only AY 2026-27 official ITR-3 schema is installed.",
        },
      ],
      warnings: [],
    };
  }
  const validate = getItr3Validate();
  const ok = validate(json) as boolean;
  const errors = (validate.errors || []).map((e) => formatAjvError(e, "ITR-3"));
  return {
    valid: ok && errors.length === 0,
    errors,
    warnings: [],
    schemaVersion: itr3Metadata.schemaVersion,
    schemaMode: "OfficialSchema",
  };
}

export function validateOfficialItrJson(json: unknown, assessmentYear: string, itrType: string): OfficialValidationResult {
  if (itrType === "ITR-3") return validateITR3Json(json, assessmentYear);
  return validateITR4Json(json, assessmentYear);
}
