import { createHash, randomBytes } from "node:crypto";

export const GENERIC_RESET_MESSAGE =
  "If an account exists for this email, a password reset link has been sent.";
export const INVALID_TOKEN_MESSAGE = "This password reset link is invalid or has expired.";
export const SUCCESS_MESSAGE = "Your password has been reset successfully.";
export const MIN_PASSWORD_LENGTH = 8;
export const TOKEN_TTL_MS = 60 * 60 * 1000;
export const RESET_EMAIL_SUBJECT = "Reset your TaxPilot password";

const RATE_LIMIT_MS = 60 * 1000;
const lastRequestAt = new Map<string, number>();
const devResetUrls = new Map<string, string>();

export type ResetTokenRow = {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  usedAt: Date | null;
};

export type PasswordResetStore = {
  findUserByEmail: (email: string) => Promise<{ id: string } | null>;
  createToken: (data: { userId: string; tokenHash: string; expiresAt: Date }) => Promise<void>;
  findToken: (tokenHash: string) => Promise<ResetTokenRow | null>;
  consumeToken: (id: string) => Promise<boolean>;
  updatePassword: (userId: string, passwordHash: string) => Promise<void>;
  hashPassword: (password: string) => Promise<string>;
};

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateResetToken() {
  return randomBytes(32).toString("hex");
}

export function composeResetEmail(resetUrl: string) {
  return {
    subject: RESET_EMAIL_SUBJECT,
    text: [
      "We received a request to reset your TaxPilot password.",
      "Use the link below to create a new password.",
      "This link expires in 1 hour.",
      "If you did not request this, you can ignore this email.",
      "",
      resetUrl,
    ].join("\n"),
  };
}

export function hashLooksHashed(stored: string | null | undefined, plaintext: string) {
  if (!stored) return false;
  return stored !== plaintext && stored.length > 20 && !stored.includes(plaintext);
}

export function takeDevResetUrl(email: string) {
  const key = email.trim().toLowerCase();
  const url = devResetUrls.get(key);
  devResetUrls.delete(key);
  return url;
}

export function clearPasswordResetRateLimit() {
  lastRequestAt.clear();
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function publicOrigin(requestOrigin?: string) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (isProduction()) return "";
  if (requestOrigin) {
    try {
      const url = new URL(requestOrigin);
      if (url.protocol === "http:" || url.protocol === "https:") return url.origin;
    } catch {
      /* ignore */
    }
  }
  return "http://127.0.0.1:3002";
}

function allowRequest(email: string, ip?: string) {
  const now = Date.now();
  const keys = [`email:${email}`];
  if (ip) keys.push(`ip:${ip}`);
  for (const key of keys) {
    const previous = lastRequestAt.get(key);
    if (previous && now - previous < RATE_LIMIT_MS) return false;
  }
  for (const key of keys) lastRequestAt.set(key, now);
  return true;
}

function isExpired(expiresAt: Date | string) {
  const t = new Date(expiresAt).getTime();
  return !Number.isFinite(t) || t < Date.now();
}

export async function requestPasswordResetWith(
  store: PasswordResetStore,
  email: string,
  opts?: { origin?: string; ip?: string },
): Promise<{ message: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@") || !allowRequest(normalized, opts?.ip)) {
    return { message: GENERIC_RESET_MESSAGE };
  }

  const user = await store.findUserByEmail(normalized);
  if (!user) {
    generateResetToken();
    await store.findToken(hashResetToken("dummy-verification-token"));
    void composeResetEmail("https://invalid.local/reset-password?token=dummy");
    console.info("[password-reset] reset requested");
    return { message: GENERIC_RESET_MESSAGE };
  }

  const token = generateResetToken();
  const tokenHash = hashResetToken(token);
  await store.createToken({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });

  const origin = publicOrigin(opts?.origin);
  if (origin) {
    const resetUrl = `${origin}/reset-password?token=${token}`;
    void composeResetEmail(resetUrl);
    if (!isProduction()) {
      devResetUrls.set(normalized, resetUrl);
    }
  }

  console.info("[password-reset] reset requested");
  return { message: GENERIC_RESET_MESSAGE };
}

export async function completePasswordResetWith(
  store: PasswordResetStore,
  input: { token: string; newPassword: string; confirmPassword: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.token) return { ok: false, error: INVALID_TOKEN_MESSAGE };
  if (input.newPassword !== input.confirmPassword) {
    return { ok: false, error: "Passwords do not match." };
  }
  if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const row = await store.findToken(hashResetToken(input.token));
  if (!row || row.usedAt || isExpired(row.expiresAt)) {
    return { ok: false, error: INVALID_TOKEN_MESSAGE };
  }

  const consumed = await store.consumeToken(row.id);
  if (!consumed) return { ok: false, error: INVALID_TOKEN_MESSAGE };

  const hashedPassword = await store.hashPassword(input.newPassword);
  await store.updatePassword(row.userId, hashedPassword);
  return { ok: true };
}

export function prismaPasswordResetStore(deps: {
  // PrismaClient is structurally wider than this store; keep the adapter dependency-free.
  prisma: {
    user: {
      findUnique: (args: { where: { email: string } }) => Promise<{ id: string } | null>;
      update: (args: { where: { id: string }; data: { passwordHash: string } }) => Promise<unknown>;
    };
    passwordResetToken: {
      create: (args: { data: { userId: string; token: string; expiresAt: Date } }) => Promise<unknown>;
      findUnique: (args: { where: { token: string } }) => Promise<ResetTokenRow | null>;
      updateMany: (args: {
        where: { id: string; usedAt: Date | null };
        data: { usedAt: Date };
      }) => Promise<{ count: number }>;
    };
  };
  hashPassword: (password: string) => Promise<string>;
}): PasswordResetStore {
  const { prisma, hashPassword } = deps;
  return {
    findUserByEmail: (email) => prisma.user.findUnique({ where: { email } }),
    createToken: async ({ userId, tokenHash, expiresAt }) => {
      await prisma.passwordResetToken.create({ data: { userId, token: tokenHash, expiresAt } });
    },
    findToken: (tokenHash) => prisma.passwordResetToken.findUnique({ where: { token: tokenHash } }),
    consumeToken: async (id) => {
      const result = await prisma.passwordResetToken.updateMany({
        where: { id, usedAt: null },
        data: { usedAt: new Date() },
      });
      return result.count === 1;
    },
    updatePassword: async (userId, passwordHash) => {
      await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    },
    hashPassword,
  };
}
