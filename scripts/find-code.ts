import schema from "../src/lib/itr-json/schemas/ay2026_27/itr4/schema.json";
const desc = (schema as any).definitions.NatOfBus44AD.properties.CodeAD.description as string;
const enumVals = (schema as any).definitions.NatOfBus44AD.properties.CodeAD.enum as string[] | undefined;
console.log("enum?", enumVals?.slice(0, 20), "count", enumVals?.length);
const hits = [...desc.matchAll(/(\d{5}) - ([^,]{0,60})/g)].slice(0, 30);
console.log(hits.map((h) => h[1] + " " + h[2]).join("\n"));
const ada = (schema as any).definitions.NatOfBus44ADA.properties.CodeADA.enum as string[] | undefined;
console.log("ADA enum first", ada?.slice(0, 10), ada?.includes("16005"));
console.log("AD includes 09027", enumVals?.includes("09027"));
