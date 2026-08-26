import type { TaxComputation } from "@/lib/tax-engine/ay2026_27";

function n(map: Record<string, number>, key: string) {
  return map[key] || 0;
}

export function chapVia(calc: TaxComputation) {
  const map: Record<string, number> = {};
  for (const d of calc.deductionLines) map[d.section] = d.eligibleAmount;
  const body = {
    Section80C: n(map, "80C"),
    Section80CCC: 0,
    Section80CCDEmployeeOrSE: n(map, "80CCD(1)"),
    Section80CCD1B: n(map, "80CCD(1B)"),
    Section80CCDEmployer: n(map, "80CCD(2)"),
    Section80D: n(map, "80D"),
    Section80DD: n(map, "80DD"),
    Section80DDB: n(map, "80DDB"),
    Section80E: n(map, "80E"),
    Section80EE: n(map, "80EE"),
    Section80EEA: n(map, "80EEA"),
    Section80EEB: n(map, "80EEB"),
    Section80G: n(map, "80G"),
    Section80GG: n(map, "80GG"),
    Section80GGC: n(map, "80GGC"),
    Section80U: n(map, "80U"),
    Section80TTA: n(map, "80TTA"),
    Section80TTB: n(map, "80TTB"),
    AnyOthSec80CCH: n(map, "80CCH"),
    TotalChapVIADeductions: calc.deductions,
  };
  return body;
}
