import { createHash } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import metadata from "@/lib/itr-json/schemas/ay2026_27/itr4/metadata.json";

const SCHEMA_PATH = path.join(process.cwd(), "src/lib/itr-json/schemas/ay2026_27/itr4/schema.json");

export function schemaFileSha256(filePath = SCHEMA_PATH) {
  const raw = readFileSync(filePath);
  return createHash("sha256").update(raw).digest("hex").toLowerCase();
}

export function compareSchemaChecksum(expected: string, actual: string) {
  const exp = String(expected || "").toLowerCase();
  const act = String(actual || "").toLowerCase();
  const ok = /^[0-9a-f]{64}$/.test(exp) && act === exp;
  return {
    ok,
    expected: exp,
    actual: act,
    message: ok
      ? "Official ITR-4 schema integrity verified."
      : "Official ITR-4 schema integrity verification failed. JSON generation has been disabled.",
  };
}

export function verifySchemaIntegrity() {
  const compared = compareSchemaChecksum(String(metadata.sha256 || ""), schemaFileSha256());
  return {
    ...compared,
    schemaVersion: metadata.schemaVersion as string,
    source: metadata.source as string,
  };
}
