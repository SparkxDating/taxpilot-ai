import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { validateITR4Json } from "@/lib/itr-json/validator/officialValidator";
import { generateITRJson } from "@/lib/itr-json/mapper";
import { fixtures } from "@/lib/tax/fixtures";

const frozen = new Date("2026-08-26T00:00:00.000Z");
const dir = path.join(process.cwd(), "tests/fixtures/itr4/ay2026_27");

describe("golden ITR-4 JSON", () => {
  it("simple.json matches deterministic output and official schema", () => {
    const g = generateITRJson(fixtures.simpleBusiness, { generatedAt: frozen });
    const disk = JSON.parse(readFileSync(path.join(dir, "simple.json"), "utf8"));
    expect(g.official.valid).toBe(true);
    expect(validateITR4Json(disk, "2026-27").valid).toBe(true);
    expect(JSON.stringify(g.json)).toBe(JSON.stringify(disk));
  });
});
