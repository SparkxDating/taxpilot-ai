import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import path from "path";
import metadata from "@/lib/itr-json/schemas/ay2026_27/itr4/metadata.json";

export const OFFICIAL_SCHEMA_PATH = path.join(process.cwd(), "src/lib/itr-json/schemas/ay2026_27/itr4/schema.json");
const FAIL_MESSAGE = "Official AY 2026–27 ITR-4 schema integrity verification failed. JSON generation is disabled.";

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
    message: ok ? "Official ITR-4 schema integrity verified." : FAIL_MESSAGE,
  };
}

export function verifySchemaFile(filePath: string, expectedSha256: string) {
  if (!existsSync(filePath)) {
    return {
      ok: false,
      expected: String(expectedSha256 || "").toLowerCase(),
      actual: "",
      message: FAIL_MESSAGE,
      missing: true,
    };
  }
  return { ...compareSchemaChecksum(expectedSha256, schemaFileSha256(filePath)), missing: false };
}

export function verifySchemaIntegrity() {
  const compared = verifySchemaFile(OFFICIAL_SCHEMA_PATH, String(metadata.sha256 || ""));
  return {
    ...compared,
    schemaVersion: metadata.schemaVersion as string,
    source: metadata.source as string,
  };
}
