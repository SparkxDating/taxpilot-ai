import { prisma } from "@/lib/db";
import { canEnterTaxModel, conflictGroup } from "./mapping";

export type ConflictFact = {
  id: string;
  documentType: string;
  field: string;
  normalizedTaxField: string;
  value: string;
  numericValue: number | null;
  sourceDocumentId: string;
};

export type ConflictDraft = {
  field: string;
  facts: ConflictFact[];
};

export function detectAmountConflicts(facts: ConflictFact[]): ConflictDraft[] {
  const groups = new Map<string, ConflictFact[]>();
  for (const f of facts) {
    const g = conflictGroup(f.normalizedTaxField);
    if (!g || f.numericValue == null) continue;
    const arr = groups.get(g) || [];
    arr.push(f);
    groups.set(g, arr);
  }
  const out: ConflictDraft[] = [];
  for (const [field, list] of groups) {
    const amounts = new Set(list.map((x) => x.numericValue));
    if (list.length >= 2 && amounts.size >= 2) out.push({ field, facts: list });
  }
  return out;
}

export function applyConflictResolution(input: {
  resolution: string;
  facts: ConflictFact[];
  chosenFactId?: string;
  manualValue?: string;
  reason?: string;
}) {
  const resolution = input.resolution;
  if (resolution === "USE_SOURCE") {
    const chosen = input.facts.find((f) => f.id === input.chosenFactId);
    if (!chosen) return { ok: false as const, error: "missing-source" };
    return {
      ok: true as const,
      status: "RESOLVED",
      resolution: "USE_SOURCE",
      chosenFactId: chosen.id,
      resolvedValue: chosen.value,
      verifyId: chosen.id,
      rejectIds: input.facts.filter((f) => f.id !== chosen.id).map((f) => f.id),
    };
  }
  if (resolution === "MANUAL_VALUE") {
    const value = String(input.manualValue || "").trim();
    if (!value) return { ok: false as const, error: "missing-value" };
    return {
      ok: true as const,
      status: "RESOLVED",
      resolution: "MANUAL_VALUE",
      chosenFactId: "",
      resolvedValue: value,
      verifyId: "",
      rejectIds: input.facts.map((f) => f.id),
    };
  }
  if (resolution === "IGNORE_WITH_REASON") {
    const reason = String(input.reason || "").trim();
    if (!reason) return { ok: false as const, error: "missing-reason" };
    return {
      ok: true as const,
      status: "IGNORED",
      resolution: "IGNORE_WITH_REASON",
      chosenFactId: "",
      resolvedValue: "",
      verifyId: "",
      rejectIds: input.facts.map((f) => f.id),
    };
  }
  return { ok: false as const, error: "unknown-resolution" };
}

export async function rebuildDocumentConflicts(returnId: string) {
  const facts = await prisma.taxFact.findMany({
    where: { returnId, status: { notIn: ["REJECTED"] } },
  });
  const drafts = detectAmountConflicts(
    facts.map((f) => ({
      id: f.id,
      documentType: f.documentType,
      field: f.field,
      normalizedTaxField: f.normalizedTaxField,
      value: f.value,
      numericValue: f.numericValue,
      sourceDocumentId: f.sourceDocumentId,
    })),
  );
  await prisma.documentConflict.deleteMany({ where: { returnId, status: "OPEN" } });
  const conflicted = new Set<string>();
  for (const d of drafts) {
    const row = await prisma.documentConflict.create({
      data: {
        returnId,
        field: d.field,
        factsJson: JSON.stringify(d.facts),
        status: "OPEN",
      },
    });
    for (const f of d.facts) {
      conflicted.add(f.id);
      await prisma.taxFact.update({
        where: { id: f.id },
        data: { status: "CONFLICT", verified: false, verifiedAt: null, verifiedBy: "", conflictWithId: row.id },
      });
    }
  }
  for (const f of facts) {
    if (conflicted.has(f.id)) continue;
    if (f.status === "CONFLICT") {
      await prisma.taxFact.update({
        where: { id: f.id },
        data: {
          status: f.verified ? "VERIFIED" : "AI_EXTRACTED",
          conflictWithId: "",
        },
      });
    }
  }
  return drafts.length;
}

export async function openConflictCount(returnId: string) {
  return prisma.documentConflict.count({ where: { returnId, status: "OPEN" } });
}

export { canEnterTaxModel };
