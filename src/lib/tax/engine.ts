import { calculateAy2026_27, type TaxComputation } from "@/lib/tax-engine/ay2026_27";
import type { NormalizedReturn } from "./model";

export type { TaxComputation };

export function TaxEngine_calculate(data: NormalizedReturn, asOfDate?: Date): TaxComputation {
  return calculateAy2026_27(data, asOfDate);
}

export const TaxEngine = { calculate: TaxEngine_calculate };
