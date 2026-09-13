import officialSchema from "@/lib/itr-json/schemas/ay2026_27/itr3/schema.json";

type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  $ref?: string;
  enum?: unknown[];
  items?: JsonSchema;
  allOf?: JsonSchema[];
  pattern?: string;
  default?: unknown;
};

const ROOT = officialSchema as { definitions: Record<string, JsonSchema> };

function resolve(node: JsonSchema): JsonSchema {
  let n: JsonSchema = { ...node };
  if (n.$ref) {
    const name = n.$ref.replace("#/definitions/", "");
    const base = ROOT.definitions[name] || {};
    const { $ref: _ref, ...rest } = n;
    n = { ...base, ...rest, $ref: undefined };
  }
  if (n.allOf?.length) {
    const merged: JsonSchema = { ...n };
    for (const part of n.allOf) {
      const r = resolve(part);
      merged.type = merged.type || r.type;
      merged.pattern = merged.pattern || r.pattern;
      merged.enum = merged.enum || r.enum;
      merged.default = merged.default !== undefined ? merged.default : r.default;
      merged.properties = { ...(r.properties || {}), ...(merged.properties || {}) };
      merged.required = [...new Set([...(merged.required || []), ...(r.required || [])])];
    }
    n = merged;
  }
  return n;
}

function isInt(n: JsonSchema) {
  const t = n.type;
  return t === "integer" || t === "number" || (Array.isArray(t) && (t.includes("integer") || t.includes("number")));
}

function ynDefault(n: JsonSchema): unknown {
  if (!n.enum?.length) return undefined;
  const vals = n.enum;
  if (vals.length === 2 && vals.includes("Y") && vals.includes("N")) return n.default ?? "N";
  if (vals.length === 2 && vals.includes("YES") && vals.includes("NO")) return n.default ?? "NO";
  if (vals.length === 2 && vals.includes("true") && vals.includes("false")) return n.default ?? "false";
  return undefined;
}

export function fillRequired(node: JsonSchema): unknown {
  const n = resolve(node);
  if (n.enum && n.enum.length) {
    if (n.default !== undefined && n.enum.includes(n.default)) return n.default;
    if (n.enum.length === 1) return n.enum[0];
    const yn = ynDefault(n);
    if (yn !== undefined) return yn;
    if (isInt(n) && typeof n.enum[0] === "number") return n.enum[0];
  }
  if (isInt(n)) return typeof n.default === "number" ? n.default : 0;
  if (n.type === "array") return [];
  if (n.default !== undefined) return n.default;
  if (n.pattern === "N|Y" || n.pattern === "Y|N") return n.default ?? "N";
  const props = n.properties;
  if (!props) return undefined;
  const out: Record<string, unknown> = {};
  for (const key of n.required || []) {
    if (!props[key]) continue;
    const val = fillRequired(props[key]);
    if (val !== undefined) out[key] = val;
  }
  return out;
}

export function fillItr3Required(): Record<string, unknown> {
  return fillRequired(ROOT.definitions.ITR3) as Record<string, unknown>;
}

export function deepMerge<T>(base: T, overlay: unknown): T {
  if (overlay === undefined) return base;
  if (overlay === null || Array.isArray(overlay) || typeof overlay !== "object" || typeof base !== "object" || base === null || Array.isArray(base)) {
    return overlay as T;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(overlay as Record<string, unknown>)) {
    out[k] = deepMerge(out[k], v);
  }
  return out as T;
}
