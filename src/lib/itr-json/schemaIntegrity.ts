import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import path from "path";

export const OFFICIAL_SCHEMA_PATH = path.join(process.cwd(), "src/lib/itr-json/schemas/ay2026_27/itr4/schema.json");
export const OFFICIAL_METADATA_PATH = path.join(process.cwd(), "src/lib/itr-json/schemas/ay2026_27/itr4/metadata.json");
export const INTEGRITY_FAIL_CODE = "OFFICIAL_SCHEMA_INTEGRITY_FAILURE";
export const INTEGRITY_FAIL_MESSAGE =
  "The official AY 2026–27 ITR-4 schema could not be verified. JSON generation has been disabled.";

export type SchemaIntegrityResult = {
  ok: boolean;
  expected: string;
  actual: string;
  message: string;
  missing: false | "schema" | "metadata";
  schemaVersion?: string;
  source?: string;
};

export function schemaFileSha256(filePath = OFFICIAL_SCHEMA_PATH) {
  if (!existsSync(filePath)) return "";
  const raw = readFileSync(filePath);
  return createHash("sha256").update(raw).digest("hex").toLowerCase();
}

export function compareSchemaChecksum(expected: string, actual: string) {
  const exp = String(expected || "").toLowerCase();
  const act = String(actual || "").toLowerCase();
  const ok = /^[0-9a-f]{64}$/.test(exp) && act.length === 64 && act === exp;
  return {
    ok,
    expected: exp,
    actual: act,
    message: ok ? "Official ITR-4 schema integrity verified." : INTEGRITY_FAIL_MESSAGE,
  };
}

export function verifySchemaFile(filePath: string, expectedSha256: string): SchemaIntegrityResult {
  if (!existsSync(filePath)) {
    return {
      ok: false,
      expected: String(expectedSha256 || "").toLowerCase(),
      actual: "",
      message: INTEGRITY_FAIL_MESSAGE,
      missing: "schema",
    };
  }
  return { ...compareSchemaChecksum(expectedSha256, schemaFileSha256(filePath)), missing: false };
}

export function verifySchemaIntegrityFrom(schemaPath: string, metadataPath: string): SchemaIntegrityResult {
  if (!existsSync(metadataPath)) {
    return {
      ok: false,
      expected: "",
      actual: existsSync(schemaPath) ? schemaFileSha256(schemaPath) : "",
      message: INTEGRITY_FAIL_MESSAGE,
      missing: "metadata",
    };
  }
  let expected = "";
  let schemaVersion: string | undefined;
  let source: string | undefined;
  try {
    const meta = JSON.parse(readFileSync(metadataPath, "utf8")) as {
      sha256?: string;
      schemaVersion?: string;
      source?: string;
      sourceUrl?: string;
    };
    expected = String(meta.sha256 || "");
    schemaVersion = meta.schemaVersion;
    source = meta.sourceUrl || meta.source;
  } catch {
    return { ok: false, expected: "", actual: "", message: INTEGRITY_FAIL_MESSAGE, missing: "metadata" };
  }
  const file = verifySchemaFile(schemaPath, expected);
  return { ...file, schemaVersion, source };
}

export function verifySchemaIntegrity() {
  return verifySchemaIntegrityFrom(OFFICIAL_SCHEMA_PATH, OFFICIAL_METADATA_PATH);
}
