import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { fixtures } from "@/lib/tax/fixtures";
import { generateITRJson } from "@/lib/itr-json/mapper";
import { validateITR3Json } from "@/lib/itr-json/validator/officialValidator";
import { loadOfficialItr3Schema, loadProductionSchema } from "@/lib/itr-json/validator/schemaLoader";
import { verifyItr3SchemaIntegrity } from "@/lib/itr-json/schemaIntegrity";
import { mapItr3FieldPath, mapItr3Official } from "@/lib/itr-json/ay2026_27/itr3/mapper";
import { canAccessReturn } from "@/lib/authz";
import metadata from "@/lib/itr-json/schemas/ay2026_27/itr3/metadata.json";
import type { NormalizedReturn } from "@/lib/tax/model";

const frozen = new Date("2026-08-26T00:00:00.000Z");

function src(rel: string) {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

function get(obj: unknown, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

const itr3 = (): NormalizedReturn => ({ ...fixtures.itr3Books });

describe("ITR-3 official schema asset", () => {
  it("stores the official AY 2026-27 ITR-3 schema with matching checksum", () => {
    const r = verifyItr3SchemaIntegrity();
    expect(r.ok).toBe(true);
    expect(r.actual).toBe(String(metadata.sha256).toLowerCase());
    expect(r.schemaVersion).toBe("Ver1.0");
    const loaded = loadOfficialItr3Schema();
    expect(loaded.kind).toBe("OfficialSchema");
    expect(loadProductionSchema("2026-27", "ITR-3").kind).toBe("OfficialSchema");
    expect(loaded.sha256.toLowerCase()).toBe(String(metadata.sha256).toLowerCase());
  });
});

describe("ITR-3 official JSON mapper", { timeout: 60_000 }, () => {
  it("TEST 1: valid synthetic ITR-3 fixture passes official schema", () => {
    const mapped = mapItr3Official(itr3(), frozen);
    const official = validateITR3Json(mapped.json, "2026-27");
    expect(official.schemaMode).toBe("OfficialSchema");
    expect(official.errors.slice(0, 8)).toEqual([]);
    expect(official.valid).toBe(true);
    const generated = generateITRJson(itr3(), { generatedAt: frozen });
    expect(generated.valid).toBe(true);
    expect(generated.json).toBeTruthy();
    expect(generated.official.valid).toBe(true);
  });

  it("TEST 2: missing required ITR-3 field fails validation", () => {
    const mapped = mapItr3Official(itr3(), frozen);
    const json = JSON.parse(JSON.stringify(mapped.json)) as { ITR: { ITR3: { PartA_GEN1: { PersonalInfo: { PAN?: string } } } } };
    delete json.ITR.ITR3.PartA_GEN1.PersonalInfo.PAN;
    const official = validateITR3Json(json, "2026-27");
    expect(official.valid).toBe(false);
    expect(official.errors.some((e) => e.keyword === "required" && (e.field === "PAN" || e.message.includes("PAN") || e.explanation.includes("PAN")))).toBe(true);
    const missing = generateITRJson({ ...itr3(), pan: "" }, { generatedAt: frozen });
    expect(missing.valid).toBe(false);
    expect(missing.json).toBeNull();
    expect(missing.errors.some((e) => e.field === "pan" || e.field === "PAN")).toBe(true);
  });

  it("TEST 3: invalid enum fails validation", () => {
    const mapped = mapItr3Official(itr3(), frozen);
    const json = JSON.parse(JSON.stringify(mapped.json)) as {
      ITR: { ITR3: { PartA_GEN1: { PersonalInfo: { Status: string }; FilingStatus: { ResidentialStatus: string } } } };
    };
    json.ITR.ITR3.PartA_GEN1.PersonalInfo.Status = "F";
    const official = validateITR3Json(json, "2026-27");
    expect(official.valid).toBe(false);
    expect(official.errors.some((e) => e.keyword === "enum")).toBe(true);
  });

  it("TEST 4: mapper produces official ITR-3 field names", () => {
    const paths = mapItr3FieldPath();
    const mapped = mapItr3Official(itr3(), frozen);
    expect(Object.prototype.hasOwnProperty.call(mapped.json, "ITR")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call((mapped.json as { ITR: { ITR3: unknown } }).ITR, "ITR3")).toBe(true);
    expect(get(mapped.json, paths.pan)).toBe("ABCDE1234F");
    expect(get(mapped.json, paths.turnover)).toBe(8_000_000);
    expect(get(mapped.json, paths.netProfit)).toBe(1_200_000);
    expect(get(mapped.json, "ITR.ITR3.Form_ITR3.FormName")).toBe("ITR-3");
    expect(get(mapped.json, "ITR.ITR3.PartA_GEN1.PersonalInfo.Address.StateCode")).toBe("15");
  });

  it("TEST 5: persisted income maps into the official ITR-3 field", () => {
    const load = src("src/lib/tax/load.ts");
    expect(load).toContain("declaredIncome: booksFromPl ? pl!.netProfit");
    expect(load).toContain("turnover: booksFromPl ? pl!.revenue");
    const mapped = mapItr3Official(itr3(), frozen);
    const paths = mapItr3FieldPath();
    expect(get(mapped.json, paths.netProfit)).toBe(itr3().business.declaredIncome);
    expect(get(mapped.json, paths.businessIncome)).toBe(1_200_000);
    expect(get(mapped.json, paths.turnover)).toBe(itr3().business.turnover);
    expect(get(mapped.json, paths.totalIncome)).toBe(mapped.calc.taxableIncome);
  });

  it("TEST 6: generated JSON cannot be downloaded if schema validation fails", () => {
    const generated = generateITRJson({ ...itr3(), pan: "" }, { generatedAt: frozen });
    expect(generated.valid).toBe(false);
    expect(generated.json).toBeNull();
    const download = src("src/app/api/returns/[id]/download-json/route.ts");
    expect(download).toContain('status: "CURRENT", valid: true');
    expect(download).toContain("validateOfficialItrJson");
    expect(download).toContain("Schema validation failed");
    const generate = src("src/app/json-actions.ts");
    expect(generate.indexOf("if (!gate.allowed || !gate.result?.json)")).toBeGreaterThan(-1);
    expect(generate.indexOf("if (!gate.allowed || !gate.result?.json)")).toBeLessThan(generate.indexOf("iTRJsonFile.create"));
    const apiGenerate = src("src/app/api/returns/[id]/generate-json/route.ts");
    expect(apiGenerate.indexOf("if (!gate.allowed || !gate.result?.json")).toBeLessThan(apiGenerate.indexOf("iTRJsonFile.create"));
  });

  it("TEST 7: user cannot generate another user's return JSON", () => {
    expect(canAccessReturn("u2", { userId: "u1", role: "USER" })).toBe(false);
    expect(canAccessReturn("u1", { userId: "u1", role: "USER" })).toBe(true);
    const generate = src("src/app/json-actions.ts");
    expect(generate).toContain("userId: session.userId");
    expect(generate).toContain("canAccessReturn");
    expect(generate).toContain("ownerUserId");
    const apiGenerate = src("src/app/api/returns/[id]/generate-json/route.ts");
    expect(apiGenerate).toContain("loadOwnedReturn");
    const download = src("src/app/api/returns/[id]/download-json/route.ts");
    expect(download).toContain("loadOwnedReturn");
    const canGen = src("src/lib/itr-json/mapper.ts");
    expect(canGen).toContain("ownerUserId");
    expect(src("src/lib/tax/load.ts")).toContain("...(userId ? { userId } : {})");
  });

  it("complete ITR-3 return: taxpayer, income, deductions, TDS map into valid JSON", () => {
    const data: NormalizedReturn = {
      ...itr3(),
      salary: { gross: 840_000, exemptions: 0, tds: 40_000, employerName: "Acme", employerTan: "DELA12345A" },
      otherIncome: [{ kind: "Interest", amount: 32_000, source: "HDFC" }],
      houseProperties: [{ occupancy: "LET_OUT", annualLetableValue: 240_000, municipalTaxes: 12_000, interestOnLoan: 50_000 }],
      deductions: [{ section: "80C", amount: 150_000 }],
      tds: [{ sectionCode: "194A", tan: "DELA12345A", amount: 3_200, deductorName: "HDFC Bank", grossAmount: 32_000 }],
    };
    const generated = generateITRJson(data, { generatedAt: frozen });
    expect(generated.errors.slice(0, 8)).toEqual([]);
    expect(generated.valid).toBe(true);
    expect(generated.json).toBeTruthy();
    expect(generated.official.valid).toBe(true);
    const paths = mapItr3FieldPath();
    expect(get(generated.json, paths.pan)).toBe("ABCDE1234F");
    expect(get(generated.json, paths.salary)).toBe(generated.calc.salaryIncome);
    expect(get(generated.json, paths.netProfit)).toBe(1_200_000);
    expect(get(generated.json, paths.turnover)).toBe(8_000_000);
    expect(get(generated.json, paths.businessIncome)).toBe(1_200_000);
    expect(get(generated.json, paths.otherSources)).toBe(32_000);
    expect(get(generated.json, paths.houseProperty)).toBe(generated.calc.housePropertyIncome);
    expect(get(generated.json, paths.tds)).toBe(generated.calc.tds);
    expect(generated.calc.tds).toBe(43_200);
    expect(get(generated.json, "ITR.ITR3.ScheduleS.TotalGrossSalary")).toBe(840_000);
    expect(get(generated.json, "ITR.ITR3.ScheduleTDS1.TotalTDSonSalaries")).toBe(40_000);
    expect(get(generated.json, "ITR.ITR3.PartB-TI.DeductionsUndSchVIADtl.TotDeductUndSchVIA")).toBe(generated.calc.deductions);
    expect(src("src/app/login/page.tsx")).toContain("loginAction");
    expect(src("src/app/actions.ts")).toContain("export async function createReturnAction");
    expect(src("src/app/actions.ts")).toContain("export async function saveProfileAction");
    expect(src("src/app/actions.ts")).toContain("export async function saveIncomeAction");
    expect(src("src/app/actions.ts")).toContain("export async function saveDeductionsAction");
    expect(src("src/app/actions.ts")).toContain("export async function saveTdsBankAction");
    expect(src("src/app/returns/[id]/summary/page.tsx")).toContain("generateJsonAction");
    expect(src("src/app/returns/[id]/json/page.tsx")).toContain("download-json");
  });
});
