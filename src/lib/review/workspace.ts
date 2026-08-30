import { documentStatusView, simpleDocumentStatus } from "@/lib/documents/prefill";

export type WorkspaceStepId = "return" | "documents" | "review" | "tax" | "finalize";

export type WorkspaceAction = { title: string; href: string };

export const WORKSPACE_STEPS: Array<{ id: WorkspaceStepId; label: string }> = [
  { id: "return", label: "Return" },
  { id: "documents", label: "Documents" },
  { id: "review", label: "Review" },
  { id: "tax", label: "Tax" },
  { id: "finalize", label: "Finalize" },
];

export function workspaceStatusLabel(input: { status?: string; processingDocs?: number; ready?: boolean; hasCurrentJson?: boolean }) {
  if (input.hasCurrentJson) return "Completed";
  if (input.ready) return "Ready";
  if ((input.processingDocs || 0) > 0 || input.status === "PROCESSING") return "Processing";
  if (input.status === "NEEDS_REVIEW" || input.status === "VALIDATION_FAILED") return "Needs review";
  return "Draft";
}

export function nextWorkspaceHref(input: {
  returnId: string;
  pendingQuestions?: number;
  hasPan?: boolean;
  hasDob?: boolean;
  documents?: number;
  needsReviewDocs?: number;
  openConflicts?: number;
  ready?: boolean;
}) {
  const id = input.returnId;
  if ((input.pendingQuestions || 0) > 0) return `/returns/${id}/interview`;
  if (!input.hasPan || !input.hasDob) return `/returns/${id}/profile`;
  if ((input.openConflicts || 0) > 0 || (input.needsReviewDocs || 0) > 0 || !input.documents) return `/returns/${id}/documents`;
  if (!input.ready) return `/returns/${id}/review`;
  return `/returns/${id}/json`;
}

export function currentWorkspaceStep(href: string): WorkspaceStepId {
  if (href.includes("/json") || href.includes("/review")) {
    if (href.endsWith("/json")) return "finalize";
    return "review";
  }
  if (href.includes("/documents")) return "documents";
  if (href.includes("/summary")) return "tax";
  if (href.includes("/profile") || href.includes("/interview") || href.includes("/income")) return "return";
  return "return";
}

export function workspaceActions(input: {
  returnId: string;
  needsReviewDocs?: number;
  openConflicts?: number;
  missingPersonal?: boolean;
  validationErrors?: Array<{ message: string; href?: string | null; section?: string | null }>;
}): WorkspaceAction[] {
  const id = input.returnId;
  const actions: WorkspaceAction[] = [];
  if (input.missingPersonal) {
    actions.push({ title: "Complete required information", href: `/returns/${id}/profile` });
  }
  if ((input.needsReviewDocs || 0) > 0) {
    actions.push({ title: "Review Form 16", href: `/returns/${id}/documents` });
  }
  if ((input.openConflicts || 0) > 0) {
    actions.push({ title: "Resolve TDS conflict", href: `/returns/${id}/documents#conflicts` });
  }
  for (const err of input.validationErrors || []) {
    if (actions.length >= 4) break;
    if (!err.message) continue;
    if (actions.some((a) => a.title === err.message)) continue;
    actions.push({ title: err.message, href: err.href || `/returns/${id}/validate` });
  }
  return actions;
}

export function documentWorkspaceSummary(
  documents: Array<{ status: string; errorCode?: string | null; taxFacts?: Array<{ status: string }> }>,
) {
  let processed = 0;
  let verified = 0;
  let needsReview = 0;
  let conflicts = 0;
  let processing = 0;
  for (const d of documents) {
    const view = documentStatusView({
      status: d.status,
      errorCode: d.errorCode,
      factStatuses: (d.taxFacts || []).map((f) => f.status),
    });
    const simple = simpleDocumentStatus({
      status: d.status,
      errorCode: d.errorCode,
      factStatuses: (d.taxFacts || []).map((f) => f.status),
    });
    if (simple === "PROCESSING") processing += 1;
    if (simple !== "PROCESSING") processed += 1;
    if (simple === "VERIFIED") verified += 1;
    if (simple === "NEEDS REVIEW" || view.label === "EXTRACTED") needsReview += 1;
    if (simple === "CONFLICT") conflicts += 1;
  }
  return {
    uploaded: documents.length,
    processed,
    verified,
    needsReview,
    conflicts,
    processing,
  };
}
