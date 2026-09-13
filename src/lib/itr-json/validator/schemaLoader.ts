import { readFileSync } from "fs";
import path from "path";
import itr4Metadata from "@/lib/itr-json/schemas/ay2026_27/itr4/metadata.json";
import itr3Metadata from "@/lib/itr-json/schemas/ay2026_27/itr3/metadata.json";
import { schemaFileSha256 } from "@/lib/itr-json/schemaIntegrity";

export type SchemaKind = "OfficialSchema" | "DevelopmentSchema";

const OFFICIAL_ITR4 = path.join(process.cwd(), "src/lib/itr-json/schemas/ay2026_27/itr4/schema.json");
const OFFICIAL_ITR3 = path.join(process.cwd(), "src/lib/itr-json/schemas/ay2026_27/itr3/schema.json");
const DEVELOPMENT = path.join(process.cwd(), "src/lib/itr-json/schemas/ay2026_27/development/adapter.schema.json");

export function loadOfficialItr4Schema() {
  const raw = readFileSync(OFFICIAL_ITR4, "utf8");
  return {
    kind: "OfficialSchema" as const,
    schema: JSON.parse(raw) as object,
    version: itr4Metadata.schemaVersion as string,
    sha256: schemaFileSha256(OFFICIAL_ITR4),
    metadata: itr4Metadata,
  };
}

export function loadOfficialItr3Schema() {
  const raw = readFileSync(OFFICIAL_ITR3, "utf8");
  return {
    kind: "OfficialSchema" as const,
    schema: JSON.parse(raw) as object,
    version: itr3Metadata.schemaVersion as string,
    sha256: schemaFileSha256(OFFICIAL_ITR3),
    metadata: itr3Metadata,
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
  if (assessmentYear !== "2026-27") {
    throw new Error(`No official production schema for ${itrType} AY ${assessmentYear}`);
  }
  if (itrType === "ITR-4") return loadOfficialItr4Schema();
  if (itrType === "ITR-3") return loadOfficialItr3Schema();
  throw new Error(`No official production schema for ${itrType} AY ${assessmentYear}`);
}
