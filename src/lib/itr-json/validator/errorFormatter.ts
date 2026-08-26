import type { ErrorObject } from "ajv";
import type { OfficialSchemaError } from "./validationTypes";

export function formatAjvError(err: ErrorObject): OfficialSchemaError {
  const path = err.instancePath || "/";
  const field = path.split("/").filter(Boolean).pop() || String(err.params?.missingProperty || "root");
  const keyword = err.keyword;
  const technical = err.message || "Schema validation failed";
  let explanation = technical;
  if (keyword === "required") explanation = `Required official ITR-4 field is missing: ${err.params?.missingProperty || field}.`;
  if (keyword === "enum") explanation = `${field} must be one of the values allowed by the official schema.`;
  if (keyword === "pattern") explanation = `${field} does not match the official format.`;
  if (keyword === "type") explanation = `${field} has the wrong type for the official ITR-4 schema.`;
  if (keyword === "additionalProperties") explanation = `Unexpected property not allowed by the official schema: ${err.params?.additionalProperty || ""}.`;
  if (keyword === "minimum" || keyword === "maximum") explanation = `${field} is outside the official numeric range.`;
  return {
    path: path || "/",
    field,
    keyword,
    message: technical,
    explanation,
  };
}
