import { createHash } from "crypto";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const OFFICIAL_URL = "https://www.incometax.gov.in/iec/foportal/sites/default/files/2026-07/ITR-4_2026_Main_V1.1.json";
const BUNDLED = "src/lib/itr-json/schemas/ay2026_27/itr4/schema.json";
const META = "src/lib/itr-json/schemas/ay2026_27/itr4/metadata.json";
const OUT_DIR = join(tmpdir(), "taxpilot-itr4-official");

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex").toLowerCase();
}

function crlf(buf) {
  return Buffer.from(buf.toString("binary").replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"), "binary");
}

function lf(buf) {
  return Buffer.from(buf.toString("binary").replace(/\r\n/g, "\n"), "binary");
}

const bundled = readFileSync(BUNDLED);
mkdirSync(OUT_DIR, { recursive: true });

const res = await fetch(OFFICIAL_URL);
if (!res.ok) {
  console.error("FETCH_FAILED", res.status, res.statusText);
  process.exit(2);
}
const official = Buffer.from(await res.arrayBuffer());
const officialPath = join(OUT_DIR, "ITR-4_2026_Main_V1.1.json");
writeFileSync(officialPath, official);

const officialSha = sha256(official);
const bundledSha = sha256(bundled);
const byteIdentical = official.equals(bundled);
const bundledCrlfSha = sha256(crlf(bundled));
const bundledLfSha = sha256(lf(bundled));
const officialCrlfSha = sha256(crlf(official));
const officialLfSha = sha256(lf(official));

let officialJson = null;
let bundledJson = null;
let parseOk = true;
try {
  officialJson = JSON.parse(official.toString("utf8"));
  bundledJson = JSON.parse(bundled.toString("utf8"));
} catch (e) {
  parseOk = false;
  console.error("JSON parse error", e);
}

const form = officialJson?.definitions?.Form_ITR4?.properties || {};
const report = {
  sourceUrl: OFFICIAL_URL,
  officialStatus: res.status,
  officialContentType: res.headers.get("content-type"),
  officialLastModified: res.headers.get("last-modified"),
  officialSavedTo: officialPath,
  officialFileSize: official.length,
  bundledFileSize: bundled.length,
  officialSha256: officialSha,
  bundledSha256: bundledSha,
  byteIdentical,
  bundledCrlfSha256: bundledCrlfSha,
  bundledLfSha256: bundledLfSha,
  officialCrlfSha256: officialCrlfSha,
  officialLfSha256: officialLfSha,
  matchesPreviouslyReportedE4f64076: {
    bundledRaw: bundledSha === "e4f640764e3c523bdf391c1f5a07adebcf02e033ec8b209240b6f75fb612cf87",
    bundledCrlf: bundledCrlfSha === "e4f640764e3c523bdf391c1f5a07adebcf02e033ec8b209240b6f75fb612cf87",
    officialRaw: officialSha === "e4f640764e3c523bdf391c1f5a07adebcf02e033ec8b209240b6f75fb612cf87",
    officialCrlf: officialCrlfSha === "e4f640764e3c523bdf391c1f5a07adebcf02e033ec8b209240b6f75fb612cf87",
  },
  parseOk,
  officialTopKeys: officialJson ? Object.keys(officialJson) : [],
  bundledTopKeys: bundledJson ? Object.keys(bundledJson) : [],
  jsonDeepEqual: parseOk ? JSON.stringify(officialJson) === JSON.stringify(bundledJson) : false,
  formNamePattern: form.FormName?.pattern,
  assessmentYearPattern: form.AssessmentYear?.pattern,
  schemaVerPattern: form.SchemaVer?.pattern,
  formVerPattern: form.FormVer?.pattern,
  $schema: officialJson?.$schema,
  verifiedAt: new Date().toISOString(),
};

writeFileSync(join(OUT_DIR, "provenance-report.json"), JSON.stringify(report, null, 2));
writeFileSync("scripts/phase24-provenance-report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

if (!byteIdentical) {
  writeFileSync(BUNDLED, official);
  report.replacedBundled = true;
  console.log("REPLACED bundled schema.json with official bytes");
} else {
  console.log("NO REPLACE: bundled is byte-identical to official");
}

const metadata = {
  assessmentYear: "2026-27",
  itrType: "ITR-4",
  schemaFile: "schema.json",
  officialFilename: "ITR-4_2026_Main_V1.1.json",
  schemaVersion: form.SchemaVer?.pattern || "Ver1.0",
  formVer: form.FormVer?.pattern || "Ver1.0",
  source: "Income Tax Department",
  sourceUrl: OFFICIAL_URL,
  sourcePage: "https://www.incometax.gov.in/iec/foportal/downloads/income-tax-returns",
  releaseDate: "2026-06-30",
  firstReleased: "2026-05-15",
  officialLastModified: res.headers.get("last-modified"),
  fileSize: official.length,
  sha256: sha256(readFileSync(BUNDLED)),
  verifiedMatch: byteIdentical || sha256(readFileSync(BUNDLED)) === officialSha,
  verifiedAt: new Date().toISOString().slice(0, 10),
  jsonSchemaDraft: officialJson?.$schema || "http://json-schema.org/draft-04/schema#",
  schemaChangeDocument:
    "https://www.incometax.gov.in/iec/foportal/sites/default/files/2026-07/ITR%204_Schema%20change%20document_AY2026-27_V1.1_0.pdf",
  validationRulesDocument:
    "https://www.incometax.gov.in/iec/foportal/sites/default/files/2026-05/CBDT_e-Filing_ITR%204_Validation%20Rules_AY%202026-27.pdf",
};
writeFileSync(META, JSON.stringify(metadata, null, 2) + "\n");
console.log("WROTE metadata sha256", metadata.sha256, "fileSize", metadata.fileSize, "verifiedMatch", metadata.verifiedMatch);
