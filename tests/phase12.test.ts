import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { canAccessReturn } from "@/lib/authz";
import { reviewReadiness } from "@/lib/review/readiness";
import {
  currentWorkspaceStep,
  documentWorkspaceSummary,
  nextWorkspaceHref,
  workspaceActions,
  workspaceStatusLabel,
} from "@/lib/review/workspace";
import type { JsonGenerationGate } from "@/lib/itr-json/mapper";

describe("Phase 12 onboarding and return workspace", () => {
  it("new user sees Start ITR-4 action", () => {
    const dash = readFileSync(join(process.cwd(), "src/app/dashboard/page.tsx"), "utf8");
    expect(dash).toContain("Start your ITR-4");
    expect(dash).toContain("Upload your tax documents and review the information");
    const start = readFileSync(join(process.cwd(), "src/app/returns/new/page.tsx"), "utf8");
    expect(start).toContain("Start your ITR-4");
    expect(start).toContain("createReturnAction");
  });

  it("start return uses the existing create-return action", () => {
    const start = readFileSync(join(process.cwd(), "src/app/returns/new/page.tsx"), "utf8");
    expect(start).toContain("createReturnAction");
    expect(start).toContain('name="assessmentYear"');
    expect(start).toContain("Continue existing return");
    const actions = readFileSync(join(process.cwd(), "src/app/actions.ts"), "utf8");
    expect(actions).toContain("export async function createReturnAction");
  });

  it("active return displays existing status", () => {
    expect(workspaceStatusLabel({ status: "IN_PROGRESS" })).toBe("Draft");
    expect(workspaceStatusLabel({ status: "NEEDS_REVIEW" })).toBe("Needs review");
    expect(workspaceStatusLabel({ ready: true })).toBe("Ready");
    expect(workspaceStatusLabel({ hasCurrentJson: true })).toBe("Completed");
    expect(workspaceStatusLabel({ processingDocs: 1 })).toBe("Processing");
  });

  it("continue button navigates to the existing next step", () => {
    expect(nextWorkspaceHref({ returnId: "r1", pendingQuestions: 2 })).toBe("/returns/r1/interview");
    expect(nextWorkspaceHref({ returnId: "r1", pendingQuestions: 0, hasPan: false, hasDob: true })).toBe("/returns/r1/profile");
    expect(nextWorkspaceHref({ returnId: "r1", hasPan: true, hasDob: true, documents: 0 })).toBe("/returns/r1/documents");
    expect(nextWorkspaceHref({ returnId: "r1", hasPan: true, hasDob: true, documents: 1, ready: false })).toBe("/returns/r1/review");
    expect(nextWorkspaceHref({ returnId: "r1", hasPan: true, hasDob: true, documents: 1, ready: true })).toBe("/returns/r1/json");
    expect(currentWorkspaceStep("/returns/r1/documents")).toBe("documents");
    const dash = readFileSync(join(process.cwd(), "src/app/dashboard/page.tsx"), "utf8");
    expect(dash).toContain("Continue return");
    expect(dash).toContain("continueHref");
  });

  it("existing validation issues appear as action-required items", () => {
    const actions = workspaceActions({
      returnId: "r1",
      missingPersonal: true,
      needsReviewDocs: 1,
      openConflicts: 1,
      validationErrors: [{ message: "PAN is required", href: "/returns/r1/profile" }],
    });
    expect(actions.some((a) => a.title === "Complete required information")).toBe(true);
    expect(actions.some((a) => a.title === "Review Form 16")).toBe(true);
    expect(actions.some((a) => a.title === "Resolve TDS conflict")).toBe(true);
    expect(actions.some((a) => a.title === "PAN is required")).toBe(true);
  });

  it("tax summary uses existing tax-engine result", () => {
    const dash = readFileSync(join(process.cwd(), "src/app/dashboard/page.tsx"), "utf8");
    expect(dash).toContain("calc.totalTax");
    expect(dash).toContain("calc.tds");
    expect(dash).toContain("calc.refundOrPayable");
    expect(dash).not.toContain("TaxEngine.calculate(");
  });

  it("final review uses existing readiness/gate", () => {
    const blocked: JsonGenerationGate = { allowed: false, data: null, result: null, error: "empty" };
    expect(reviewReadiness(blocked).status).toBe("NOT_READY");
    const dash = readFileSync(join(process.cwd(), "src/app/dashboard/page.tsx"), "utf8");
    expect(dash).toContain("canGenerateItrJson");
    expect(dash).toContain("reviewReadiness");
    expect(dash).toContain("Return ready");
    expect(dash).toContain("Complete review");
  });

  it("user cannot access another user's return", () => {
    expect(canAccessReturn("u2", { userId: "u1", role: "USER" })).toBe(false);
    expect(canAccessReturn("u1", { userId: "u1", role: "USER" })).toBe(true);
    const dash = readFileSync(join(process.cwd(), "src/app/dashboard/page.tsx"), "utf8");
    expect(dash).toContain("userId: session.userId");
  });

  it("document summary reuses existing document statuses", () => {
    const summary = documentWorkspaceSummary([
      { status: "VERIFIED", taxFacts: [{ status: "VERIFIED" }] },
      { status: "EXTRACTED", taxFacts: [{ status: "AI_EXTRACTED" }] },
      { status: "NEEDS_REVIEW", taxFacts: [{ status: "CONFLICT" }] },
    ]);
    expect(summary.uploaded).toBe(3);
    expect(summary.verified).toBe(1);
    expect(summary.conflicts).toBe(1);
    expect(summary.needsReview).toBeGreaterThan(0);
  });
});
