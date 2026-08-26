import { readFileSync, writeFileSync } from "fs";

const schema = JSON.parse(
  readFileSync("src/lib/itr-json/schemas/ay2026_27/itr4/schema.json", "utf8"),
);

function findByKey(obj, key, hits = []) {
  if (!obj || typeof obj !== "object") return hits;
  if (Object.prototype.hasOwnProperty.call(obj, key)) hits.push(obj[key]);
  for (const v of Object.values(obj)) findByKey(v, key, hits);
  return hits;
}

const pickEnum = (nodes) => {
  for (const n of nodes) {
    if (n && n.enum) return n.enum;
    if (n && n.items && n.items.enum) return n.items.enum;
    if (Array.isArray(n)) {
      for (const x of n) {
        if (x && x.enum) return x.enum;
      }
    }
  }
  return [];
};

const ad = pickEnum(findByKey(schema, "CodeAD"));
const ada = pickEnum(findByKey(schema, "CodeADA"));
writeFileSync("scripts/nature-codes.extracted.json", JSON.stringify({ CodeAD: ad, CodeADA: ada }, null, 2));
console.log("CodeAD", ad.length, "CodeADA", ada.length);
