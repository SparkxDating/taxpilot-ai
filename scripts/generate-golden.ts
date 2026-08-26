import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { fixtures } from "../src/lib/tax/fixtures";
import { generateITRJson } from "../src/lib/itr-json/mapper";
import { TaxEngine } from "../src/lib/tax/engine";
import { evaluateFilingGate } from "../src/lib/validation/filingGate";
import type { NormalizedReturn } from "../src/lib/tax/model";

const frozen = new Date("2026-08-26T00:00:00.000Z");
const root = path.join(process.cwd(), "tests/fixtures/itr4/ay2026_27");

function taxSlice(calc: ReturnType<typeof TaxEngine.calculate>) {
  return {
    regime: calc.regime,
    salaryIncome: calc.salaryIncome,
    businessIncome: calc.businessIncome,
    professionIncome: calc.professionIncome,
    housePropertyIncome: calc.housePropertyIncome,
    otherSources: calc.otherSources,
    capitalGains: calc.capitalGains,
    normalRateIncome: calc.normalRateIncome,
    specialRateIncome: calc.specialRateIncome,
    taxBeforeRebate: calc.taxBeforeRebate,
    taxOnSpecialRate: calc.taxOnSpecialRate,
    rebate: calc.rebate,
    surcharge: calc.surcharge,
    cess: calc.cess,
    totalTax: calc.totalTax,
    tds: calc.tds,
    tcs: calc.tcs,
    prepaid: calc.prepaid,
    settlement: calc.settlement,
    flags: calc.flags,
  };
}

function writeCase(name: string, input: NormalizedReturn) {
  const dir = path.join(root, name);
  mkdirSync(dir, { recursive: true });
  const generated = generateITRJson(input, { generatedAt: frozen, returnId: "fixture" });
  const gate = evaluateFilingGate(input, "fixture", frozen);
  writeFileSync(path.join(dir, "input.json"), JSON.stringify(input, null, 2));
  writeFileSync(path.join(dir, "expected.json"), JSON.stringify(generated.json, null, 2));
  writeFileSync(path.join(dir, "expectedTax.json"), JSON.stringify(taxSlice(generated.calc), null, 2));
  writeFileSync(path.join(dir, "expectedValidation.json"), JSON.stringify({ ready: gate.ready, layers: gate.layers }, null, 2));
  console.log(name, "ready=", gate.ready, "schema=", gate.layers.schema);
}

writeCase("simple", fixtures.simpleBusiness);
writeCase("professional", fixtures.professional);
writeCase("salary-business", fixtures.salaryPlusBusiness);
writeCase("business-interest", fixtures.businessInterest);
writeCase("tax-payable", fixtures.withTds);

const refund: NormalizedReturn = {
  ...fixtures.simpleBusiness,
  salary: { gross: 500_000, exemptions: 0, tds: 40_000, employerName: "Acme", employerTan: "DELA12345A" },
};
writeCase("refund", refund);

const capitalGains: NormalizedReturn = {
  ...fixtures.simpleBusiness,
  capitalGains: [
    {
      kind: "LTCG_112A",
      section: "112A",
      amount: 100_000,
      saleConsideration: 400_000,
      acquisitionCost: 300_000,
      acquisitionDate: "2023-01-15",
      saleDate: "2026-02-01",
    },
  ],
};
writeCase("capital-gains-112a", capitalGains);
