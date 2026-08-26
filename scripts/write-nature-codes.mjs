import { readFileSync, writeFileSync } from "fs";

const j = JSON.parse(readFileSync("scripts/nature-codes.extracted.json", "utf8"));
const src = `/** Official ITR-4 AY 2026-27 nature-of-business codes from schema.json (CodeAD / CodeADA). Do not invent codes. */
export const CODE_AD = ${JSON.stringify(j.CodeAD)} as const;
export const CODE_ADA = ${JSON.stringify(j.CodeADA)} as const;
export type CodeAD = (typeof CODE_AD)[number];
export type CodeADA = (typeof CODE_ADA)[number];
export function isCodeAD(v: string | undefined): v is CodeAD {
  return !!v && (CODE_AD as readonly string[]).includes(v);
}
export function isCodeADA(v: string | undefined): v is CodeADA {
  return !!v && (CODE_ADA as readonly string[]).includes(v);
}
`;
writeFileSync("src/lib/itr-json/ay2026_27/itr4/natureCodes.ts", src);
console.log("wrote natureCodes.ts", j.CodeAD.length, j.CodeADA.length);
