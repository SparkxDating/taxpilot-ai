import { readFileSync } from "fs";
import path from "path";
import metadata from "@/lib/itr-json/schemas/ay2026_27/itr4/metadata.json";
import { schemaFileSha256 } from "@/lib/itr-json/schemaIntegrity";

export type SchemaKind = "OfficialSchema" | "DevelopmentSchema";

const OFFICIAL = path.join(process.cwd(), "src/lib/itr-json/schemas/ay2026_27/itr4/schema.json");
const DEVELOPMENT = path.join(process.cwd(), "src/lib/itr-json/schemas/ay2026_27/development/adapter.schema.json");

export function loadOfficialItr4Schema() {
  const raw = readFileSync(OFFICIAL, "utf8");
  return {
    kind: "OfficialSchema" as const,
    schema: JSON.parse(raw) as object,
    version: metadata.schemaVersion as string,
    sha256: schemaFileSha256(OFFICIAL),
    metadata,
  };
}

/** Never used by production JSON generation or official validation. */
export function loadDevelopmentAdapterSchema() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Development adapter schema is not permitted in production.");
  }
  const raw = readFileSync(DEVELOPMENT, "utf8");
  return {
    kind: "DevelopmentSchema" as const,
    schema: JSON.parse(raw) as object,
    version: "adapter-dev",
  };
}

/** Production always returns OfficialSchema. */
export function loadProductionSchema(assessmentYear: string, itrType: string) {
  if (assessmentYear !== "2026-27" || itrType !== "ITR-4") {
    throw new Error(`No official production schema for ${itrType} AY ${assessmentYear}`);
  }
  return loadOfficialItr4Schema();
}
