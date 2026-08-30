import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  applyVerifiedFactsToState,
  classifyEdit,
  emptyPreparation,
  resetToImported,
  shouldOverwriteFromVerified,
  type AuthoritativeFact,
  type PreparationState,
  type SalaryModel,
} from "@/lib/documents/prefill";

const form16Gross = (amount: number, id = "fact-gross"): AuthoritativeFact => ({
  id,
  status: "VERIFIED",
  verified: true,
  normalizedTaxField: "salary.grossSalary",
  documentType: "FORM_16",
  value: String(amount),
  numericValue: amount,
  sourceDocumentId: "doc-form16",
  sourcePage: "2",
});

function apply(opts: {
  prep: PreparationState;
  salary: SalaryModel | null;
  facts: AuthoritativeFact[];
}) {
  return applyVerifiedFactsToState({
    prep: opts.prep,
    facts: opts.facts,
    openGroups: new Set(),
    existingSalary: opts.salary,
    existingInterest: null,
    existingDividend: null,
    existingBusiness: null,
  });
}

describe("Phase 5.1 user-edit precedence", () => {
  it("keeps a user-edited gross salary when the same verified Form 16 fact is applied again", () => {
    const fact = form16Gross(1_250_000);
    const created = apply({ prep: emptyPreparation(), salary: null, facts: [fact] });
    expect(created.salary?.grossSalary).toBe(1_250_000);
    expect(created.prep.fields["salary.grossSalary"].origin).toBe("IMPORTED");
    expect(created.prep.fields["salary.grossSalary"].originalValue).toBe("1250000");
    expect(created.prep.fields["salary.grossSalary"].currentValue).toBe("1250000");
    expect(created.prep.fields["salary.grossSalary"].source).toBe("FORM_16");

    const editedPrep: PreparationState = {
      fields: {
        ...created.prep.fields,
        "salary.grossSalary": classifyEdit(created.prep.fields["salary.grossSalary"], "1270000"),
      },
    };
    const editedSalary: SalaryModel = { ...created.salary!, grossSalary: 1_270_000 };
    expect(editedPrep.fields["salary.grossSalary"].origin).toBe("USER_EDITED");
    expect(shouldOverwriteFromVerified(editedPrep.fields["salary.grossSalary"])).toBe(false);

    const again = apply({ prep: editedPrep, salary: editedSalary, facts: [fact] });
    expect(again.salary?.grossSalary).toBe(1_270_000);
    expect(again.prep.fields["salary.grossSalary"].currentValue).toBe("1270000");
    expect(again.prep.fields["salary.grossSalary"].originalValue).toBe("1250000");
    expect(again.prep.fields["salary.grossSalary"].origin).toBe("USER_EDITED");
    expect(again.prep.fields["salary.grossSalary"].source).not.toBe("USER_INPUT");
  });

  it("updates an unedited imported value when the verified source changes", () => {
    const first = apply({ prep: emptyPreparation(), salary: null, facts: [form16Gross(1_250_000)] });
    expect(first.salary?.grossSalary).toBe(1_250_000);
    const second = apply({
      prep: first.prep,
      salary: first.salary,
      facts: [form16Gross(1_260_000, "fact-gross-2")],
    });
    expect(second.salary?.grossSalary).toBe(1_260_000);
    expect(second.prep.fields["salary.grossSalary"].origin).toBe("IMPORTED");
    expect(second.prep.fields["salary.grossSalary"].currentValue).toBe("1260000");
    expect(second.prep.fields["salary.grossSalary"].originalValue).toBe("1260000");
  });

  it("does not overwrite manual USER_INPUT and does not claim a document source", () => {
    const manual = classifyEdit(undefined, "1270000");
    expect(manual.origin).toBe("USER_INPUT");
    expect(manual.source).toBe("USER_INPUT");
    const result = apply({
      prep: { fields: { "salary.grossSalary": manual } },
      salary: {
        grossSalary: 1_270_000,
        tds: 0,
        employerName: "",
        employerTan: "",
        exemptions: 0,
        standardDeduction: 0,
      },
      facts: [form16Gross(1_250_000)],
    });
    expect(result.salary?.grossSalary).toBe(1_270_000);
    expect(result.prep.fields["salary.grossSalary"].origin).toBe("USER_INPUT");
    expect(result.prep.fields["salary.grossSalary"].source).toBe("USER_INPUT");
    expect(result.prep.fields["salary.grossSalary"].currentValue).toBe("1270000");
  });

  it("resets a user edit to the latest imported value without dropping provenance", () => {
    const imported = apply({ prep: emptyPreparation(), salary: null, facts: [form16Gross(1_250_000)] });
    const edited = classifyEdit(imported.prep.fields["salary.grossSalary"], "1270000");
    const reset = resetToImported(edited);
    expect(reset.origin).toBe("IMPORTED");
    expect(reset.currentValue).toBe("1250000");
    expect(reset.factId).toBe("fact-gross");
    expect(reset.source).toBe("FORM_16");
  });

  it("does not create a second salary value when the same fact is applied twice", () => {
    const fact = form16Gross(1_250_000);
    const first = apply({ prep: emptyPreparation(), salary: null, facts: [fact] });
    const second = apply({ prep: first.prep, salary: first.salary, facts: [fact] });
    expect(second.salary?.grossSalary).toBe(1_250_000);
    expect(second.prep.fields["salary.grossSalary"].origin).toBe("IMPORTED");
    expect(second.prep.fields["salary.grossSalary"].factId).toBe("fact-gross");
    const src = readFileSync(join(process.cwd(), "src/lib/documents/applyVerified.ts"), "utf8");
    expect(src).not.toContain("salaryIncome.deleteMany");
    expect(src).not.toContain("otherIncome.deleteMany");
    expect(src).toContain("recomputeReturn");
  });
});

describe("Phase 5.2 original imported value is immutable after user edit", () => {
  it("keeps the first Form 16 amount when a later verified source disagrees", () => {
    const first = apply({ prep: emptyPreparation(), salary: null, facts: [form16Gross(1_250_000)] });
    const editedPrep: PreparationState = {
      fields: {
        ...first.prep.fields,
        "salary.grossSalary": classifyEdit(first.prep.fields["salary.grossSalary"], "1270000"),
      },
    };
    const editedSalary: SalaryModel = { ...first.salary!, grossSalary: 1_270_000 };
    const later = apply({
      prep: editedPrep,
      salary: editedSalary,
      facts: [form16Gross(1_260_000, "fact-gross-later")],
    });
    const field = later.prep.fields["salary.grossSalary"];
    expect(later.salary?.grossSalary).toBe(1_270_000);
    expect(field.currentValue).toBe("1270000");
    expect(field.originalValue).toBe("1250000");
    expect(field.origin).toBe("USER_EDITED");
    expect(field.source).toBe("USER_EDITED");
    expect(field.originalSource).toBe("VERIFIED_IMPORT");
    expect(field.sourceDocumentType).toBe("FORM_16");
  });
});
