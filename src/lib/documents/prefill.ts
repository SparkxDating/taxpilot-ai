import { canEnterTaxModel, conflictGroup } from "./mapping";

export type PrefillOrigin = "IMPORTED" | "USER_EDITED" | "USER_INPUT";

export type PrefillEntry = {
  origin: PrefillOrigin;
  source: string;
  sourceDocumentId: string;
  sourcePage: number | null;
  originalValue: string;
  currentValue: string;
  factId: string;
};

export type PreparationState = { fields: Record<string, PrefillEntry> };

export type AuthoritativeFact = {
  id: string;
  status: string;
  verified: boolean;
  normalizedTaxField: string;
  documentType: string;
  value: string;
  numericValue: number | null;
  sourceDocumentId: string;
  sourcePage: string;
};

export function emptyPreparation(): PreparationState {
  return { fields: {} };
}

export function parsePreparation(raw: string | null | undefined): PreparationState {
  if (!raw) return emptyPreparation();
  try {
    const parsed = JSON.parse(raw) as PreparationState;
    if (!parsed || typeof parsed !== "object" || !parsed.fields) return emptyPreparation();
    return { fields: parsed.fields };
  } catch {
    return emptyPreparation();
  }
}

export function pickAuthoritativeFacts(facts: AuthoritativeFact[], openGroups: Set<string>) {
  return facts.filter(
    (f) =>
      canEnterTaxModel(f.status, f.verified) &&
      Boolean(f.normalizedTaxField) &&
      !openGroups.has(conflictGroup(f.normalizedTaxField)),
  );
}

export function importedEntry(fact: AuthoritativeFact, currentValue?: string): PrefillEntry {
  const value = currentValue ?? fact.value;
  return {
    origin: "IMPORTED",
    source: fact.documentType || "DOCUMENT",
    sourceDocumentId: fact.sourceDocumentId,
    sourcePage: fact.sourcePage ? Number(fact.sourcePage) : null,
    originalValue: fact.value,
    currentValue: value,
    factId: fact.id,
  };
}

export function classifyEdit(prev: PrefillEntry | undefined, nextValue: string): PrefillEntry {
  if (!prev) {
    return {
      origin: "USER_INPUT",
      source: "USER_INPUT",
      sourceDocumentId: "",
      sourcePage: null,
      originalValue: nextValue,
      currentValue: nextValue,
      factId: "",
    };
  }
  if (prev.origin === "IMPORTED" || prev.origin === "USER_EDITED") {
    const same = String(prev.originalValue) === String(nextValue);
    return { ...prev, currentValue: nextValue, origin: same ? "IMPORTED" : "USER_EDITED" };
  }
  return { ...prev, currentValue: nextValue, origin: "USER_INPUT", source: "USER_INPUT" };
}

export function resetToImported(entry: PrefillEntry): PrefillEntry {
  return { ...entry, currentValue: entry.originalValue, origin: "IMPORTED" };
}

export function shouldOverwriteFromVerified(entry: PrefillEntry | undefined) {
  if (!entry) return true;
  return entry.origin === "IMPORTED";
}

export type SectionStatus = "COMPLETE" | "NEEDS REVIEW" | "MISSING" | "CONFLICT";

export function sectionStatus(opts: {
  openConflicts: number;
  needsReviewFacts: number;
  missingRequired: boolean;
}): SectionStatus {
  if (opts.openConflicts > 0) return "CONFLICT";
  if (opts.needsReviewFacts > 0) return "NEEDS REVIEW";
  if (opts.missingRequired) return "MISSING";
  return "COMPLETE";
}

export function importSummary(opts: {
  processedDocuments: number;
  verifiedFacts: number;
  needsReviewFacts: number;
  openConflicts: number;
  importedValues: number;
}) {
  return {
    documents: opts.processedDocuments,
    verifiedFacts: opts.verifiedFacts,
    needsReview: opts.needsReviewFacts,
    conflicts: opts.openConflicts,
    importedValues: opts.importedValues,
  };
}

export function overviewFromRecords(id: string, input: {
  documents: Array<{ status: string; processedAt?: Date | null }>;
  facts: Array<{ status: string; verified: boolean; normalizedTaxField: string }>;
  openConflicts: Array<{ field: string }>;
  prep: PreparationState;
  hasPan: boolean;
  salarySources: boolean;
  hasSalary: boolean;
  businessSources: boolean;
  hasBusiness: boolean;
  hasBank: boolean;
  validationErrors: number;
}) {
  const processedDocuments = input.documents.filter((d) => d.processedAt || !["UPLOADED", "PROCESSING"].includes(d.status)).length;
  const verifiedFacts = input.facts.filter((f) => f.status === "VERIFIED" && f.verified).length;
  const needsReviewFacts = input.facts.filter((f) => ["AI_EXTRACTED", "PENDING", "CONFLICT"].includes(f.status)).length;
  const openConflicts = input.openConflicts.length;
  const importedValues = Object.values(input.prep.fields).filter((e) => e.origin === "IMPORTED" || e.origin === "USER_EDITED").length;
  const groupOpen = (g: string) => input.openConflicts.filter((c) => c.field === g).length;
  const pending = (prefix: string) =>
    input.facts.filter((f) => f.normalizedTaxField.startsWith(prefix) && ["AI_EXTRACTED", "PENDING", "CONFLICT"].includes(f.status)).length;
  const sections = [
    { label: "Personal", href: `/returns/${id}/profile`, status: sectionStatus({ openConflicts: 0, needsReviewFacts: 0, missingRequired: !input.hasPan }) },
    { label: "Salary", href: `/returns/${id}/income`, status: sectionStatus({ openConflicts: groupOpen("SALARY"), needsReviewFacts: pending("salary."), missingRequired: input.salarySources && !input.hasSalary }) },
    { label: "Other sources", href: `/returns/${id}/income`, status: sectionStatus({ openConflicts: groupOpen("INTEREST") + groupOpen("DIVIDEND"), needsReviewFacts: pending("income."), missingRequired: false }) },
    { label: "Deductions", href: `/returns/${id}/deductions`, status: sectionStatus({ openConflicts: 0, needsReviewFacts: pending("deductions."), missingRequired: false }) },
    { label: "Business/Profession", href: `/returns/${id}/income`, status: sectionStatus({ openConflicts: 0, needsReviewFacts: 0, missingRequired: input.businessSources && !input.hasBusiness }) },
    { label: "TDS", href: `/returns/${id}/tds`, status: sectionStatus({ openConflicts: groupOpen("TDS"), needsReviewFacts: pending("salary.tds") + pending("tds."), missingRequired: false }) },
    { label: "Review", href: `/returns/${id}/review`, status: sectionStatus({ openConflicts, needsReviewFacts: input.validationErrors, missingRequired: !input.hasBank }) },
  ];
  return { summary: importSummary({ processedDocuments, verifiedFacts, needsReviewFacts, openConflicts, importedValues }), sections };
}
