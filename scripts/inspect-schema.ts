import schema from "../src/lib/itr-json/schemas/ay2026_27/itr4/schema.json";

const s = schema as Record<string, unknown>;
console.log("top keys", Object.keys(s));
console.log("title", s.title);
console.log("$schema", s.$schema);
console.log("id", s.id || s.$id);
const defs = (s.definitions || s.$defs || {}) as Record<string, unknown>;
console.log("def count", Object.keys(defs).length);
console.log("def keys", Object.keys(defs));
const props = (s.properties || {}) as Record<string, unknown>;
console.log("root props", Object.keys(props));

function walk(name: string, node: unknown, depth: number) {
  if (!node || typeof node !== "object" || depth > 3) return;
  const n = node as Record<string, unknown>;
  const p = (n.properties || {}) as Record<string, unknown>;
  if (Object.keys(p).length) {
    console.log("  ".repeat(depth) + name + " props: " + Object.keys(p).join(", "));
    if (n.required) console.log("  ".repeat(depth) + name + " required: " + JSON.stringify(n.required));
    for (const [k, v] of Object.entries(p)) walk(k, v, depth + 1);
  } else if (n.$ref) {
    console.log("  ".repeat(depth) + name + " $ref " + n.$ref);
  }
}

walk("ROOT", s, 0);
for (const k of Object.keys(defs).slice(0, 40)) {
  const d = defs[k] as Record<string, unknown>;
  const p = d.properties as Record<string, unknown> | undefined;
  console.log("DEF", k, p ? Object.keys(p).join(",") : d.type || d.$ref);
}
