import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { fixtures } from "../src/lib/tax/fixtures";
import { generateITRJson } from "../src/lib/itr-json/mapper";

const frozen = new Date("2026-08-26T00:00:00.000Z");
const dir = path.join("tests/fixtures/itr4/ay2026_27");
mkdirSync(dir, { recursive: true });

const cases: Array<[string, keyof typeof fixtures | "refund" | "taxPayable"]> = [
  ["simple.json", "simpleBusiness"],
  ["business.json", "simpleBusiness"],
  ["professional.json", "professional"],
  ["tax-payable.json", "withTds"],
];

for (const [file, key] of cases) {
  const data = fixtures[key as keyof typeof fixtures];
  const g = generateITRJson(data, { generatedAt: frozen });
  writeFileSync(path.join(dir, file), JSON.stringify(g.json, null, 2));
  console.log(file, "valid", g.official.valid, "errors", g.official.errors.length);
}

const refundData = {
  ...fixtures.simpleBusiness,
  salary: { gross: 500_000, exemptions: 0, tds: 40_000, employerName: "Acme", employerTan: "DELA12345A" },
};
const refund = generateITRJson(refundData, { generatedAt: frozen });
writeFileSync(path.join(dir, "refund.json"), JSON.stringify(refund.json, null, 2));
console.log("refund.json valid", refund.official.valid);

const cg = generateITRJson(
  {
    ...fixtures.simpleBusiness,
    capitalGains: [{ kind: "LTCG_112A", section: "112A", amount: 80_000, saleConsideration: 200_000, acquisitionCost: 120_000 }],
  },
  { generatedAt: frozen },
);
writeFileSync(path.join(dir, "capital-gains.json"), JSON.stringify(cg.json, null, 2));
console.log("capital-gains.json valid", cg.official.valid, cg.official.errors.slice(0, 3));
