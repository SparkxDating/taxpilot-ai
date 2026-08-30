export const PLAN_FREE = "FREE";
export const PLAN_PRO = "PRO";

export type AccessPlan = "FREE" | "PRO";

export type SubscriptionAccess = {
  plan?: string | null;
  status?: string | null;
} | null | undefined;

export const UPGRADE_HEADING = "Your return is ready.";
export const UPGRADE_DETAIL = "Upgrade to Pro to generate/download your final ITR-4.";
export const PRO_REQUIRED_CODE = "PRO_REQUIRED";
export const PRO_REQUIRED_MESSAGE = "Upgrade to Pro to generate/download your final ITR-4.";
export const PRICING_PATH = "/pricing";

const ACTIVE = "ACTIVE";
const PRO_PLANS = new Set(["PRO", "ITR4", "ITR3", "PROFESSIONAL", "CA_FIRM"]);

export function normalizePlan(plan?: string | null): AccessPlan {
  const value = String(plan || "").trim().toUpperCase();
  if (!value || value === PLAN_FREE) return PLAN_FREE;
  if (PRO_PLANS.has(value)) return PLAN_PRO;
  return PLAN_FREE;
}

export function isProUser(subscription?: SubscriptionAccess): boolean {
  if (!subscription) return false;
  const status = String(subscription.status || ACTIVE).trim().toUpperCase();
  if (status !== ACTIVE) return false;
  return normalizePlan(subscription.plan) === PLAN_PRO;
}

export function planLabel(subscription?: SubscriptionAccess): "Free" | "Pro" {
  return isProUser(subscription) ? "Pro" : "Free";
}

export type UserAccess = {
  plan: AccessPlan;
  isPro: boolean;
  label: "Free" | "Pro";
};

export function accessFromSubscription(subscription?: SubscriptionAccess): UserAccess {
  const isPro = isProUser(subscription);
  return {
    plan: isPro ? PLAN_PRO : PLAN_FREE,
    isPro,
    label: isPro ? "Pro" : "Free",
  };
}

export async function getUserAccess(userId: string): Promise<UserAccess> {
  if (!userId) return accessFromSubscription(null);
  const { prisma } = await import("./db");
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true },
  });
  return accessFromSubscription(subscription);
}

export function requireProAccess(subscription?: SubscriptionAccess) {
  if (isProUser(subscription)) return { allowed: true as const };
  return {
    allowed: false as const,
    code: PRO_REQUIRED_CODE,
    message: PRO_REQUIRED_MESSAGE,
    upgradeUrl: PRICING_PATH,
  };
}

export function proRequiredBody() {
  return {
    error: PRO_REQUIRED_MESSAGE,
    code: PRO_REQUIRED_CODE,
    upgradeUrl: PRICING_PATH,
  };
}

export function jsonExportUpgradePath(returnId: string) {
  return `/returns/${returnId}/summary?upgrade=1`;
}
