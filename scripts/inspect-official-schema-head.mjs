import { readFileSync } from "fs";

const j = JSON.parse(readFileSync("src/lib/itr-json/schemas/ay2026_27/itr4/schema.json", "utf8"));
console.log("topKeys", Object.keys(j).join(","));
console.log("$schema", j.$schema);
const form = j.definitions?.Form_ITR4;
if (form?.properties) {
  console.log("Form_ITR4 props", Object.keys(form.properties).join(","));
  console.log("AssessmentYear pattern", form.properties.AssessmentYear?.pattern);
  console.log("SchemaVer pattern", form.properties.SchemaVer?.pattern);
  console.log("FormVer pattern", form.properties.FormVer?.pattern);
  console.log("FormName pattern", form.properties.FormName?.pattern);
}
console.log("required root", j.required);
console.log("ITR required", j.definitions?.ITR?.required);
