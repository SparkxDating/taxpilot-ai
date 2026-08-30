import { createHash, randomBytes } from "node:crypto";
import { hash as bcryptHash, compare as bcryptCompare } from "bcryptjs";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  GENERIC_RESET_MESSAGE,
  INVALID_TOKEN_MESSAGE,
  MIN_PASSWORD_LENGTH,
  RESET_EMAIL_SUBJECT,
  RESET_UNAVAILABLE_MESSAGE,
  TOKEN_TTL_MS,
  type PasswordResetStore,
  type ResetEmailPayload,
  type ResetTokenRow,
  canSendProductionResetEmail,
  clearPasswordResetRateLimit,
  completePasswordResetWith,
  composeResetEmail,
  generateResetToken,
  hashLooksHashed,
  hashResetToken,
  isResetEmailConfigured,
  isValidPublicOrigin,
  publicOrigin,
  requestPasswordResetWith,
  sendConfiguredResetEmail,
  takeDevResetUrl,
} from "@/lib/password-reset";

const OLD_PASSWORD = "old-password-123";
const NEW_PASSWORD = "new-password-456";

function tokenFromUrl(url: string | undefined) {
  expect(url).toBeTruthy();
  const parsed = new URL(url!);
  const token = parsed.searchParams.get("token");
  expect(token).toBeTruthy();
  expect(parsed.pathname).toBe("/reset-password");
  return token!;
}

function createMemoryStore(seed?: { email: string; passwordHash: string }) {
  const users = new Map<string, { id: string; email: string }>();
  const tokens = new Map<string, ResetTokenRow>();
  const passwords = new Map<string, string>();
  const returns = new Map<string, string[]>();
  const emails: ResetEmailPayload[] = [];
  if (seed) {
    const id = "user-1";
    users.set(seed.email, { id, email: seed.email });
    passwords.set(id, seed.passwordHash);
    returns.set(id, ["return-1"]);
  }

  const store: PasswordResetStore = {
    findUserByEmail: async (email) => users.get(email) ?? null,
    createToken: async (data) => {
      tokens.set(data.tokenHash, {
        id: randomBytes(8).toString("hex"),
        userId: data.userId,
        token: data.tokenHash,
        expiresAt: data.expiresAt,
        usedAt: null,
      });
    },
    findToken: async (tokenHash) => tokens.get(tokenHash) ?? null,
    consumeToken: async (id) => {
      const row = [...tokens.values()].find((item) => item.id === id);
      if (!row || row.usedAt) return false;
      row.usedAt = new Date();
      return true;
    },
    updatePassword: async (userId, passwordHash) => {
      passwords.set(userId, passwordHash);
    },
    hashPassword: (password) => bcryptHash(password, 12),
    deliverResetEmail: async (payload) => {
      emails.push(payload);
    },
    commitReset: async ({ tokenId, userId, passwordHash }) => {
      await store.updatePassword(userId, passwordHash);
      return store.consumeToken(tokenId);
    },
  };

  return { store, tokens, passwords, returns, emails };
}

describe("Phase 13 password reset", () => {
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    RESET_EMAIL_FROM: process.env.RESET_EMAIL_FROM,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    APP_URL: process.env.APP_URL,
  };

  afterEach(() => {
    Reflect.set(process.env, "NODE_ENV", originalEnv.NODE_ENV);
    for (const key of ["RESEND_API_KEY", "EMAIL_FROM", "RESET_EMAIL_FROM", "NEXT_PUBLIC_APP_URL", "APP_URL"] as const) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
    clearPasswordResetRateLimit();
  });

  beforeEach(() => {
    clearPasswordResetRateLimit();
    process.env.RESEND_API_KEY = "test-resend-key";
    process.env.EMAIL_FROM = "TaxPilot <noreply@taxpilot.test>";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.taxpilot.test";
    delete process.env.RESET_EMAIL_FROM;
    delete process.env.APP_URL;
  });

  it("login page has a Forgot password link to the reset request page", () => {
    const login = readFileSync(join(process.cwd(), "src/app/login/page.tsx"), "utf8");
    expect(login).not.toContain("Forgot password?");
    expect(login).not.toContain('href="/forgot-password"');
    const forgot = readFileSync(join(process.cwd(), "src/app/forgot-password/page.tsx"), "utf8");
    expect(forgot).toContain("requestPasswordResetAction");
    expect(forgot).toContain("GENERIC_RESET_MESSAGE");
    expect(forgot).toContain("RESET_UNAVAILABLE_MESSAGE");
    const reset = readFileSync(join(process.cwd(), "src/app/reset-password/page.tsx"), "utf8");
    expect(reset).toContain("completePasswordResetAction");
    expect(reset).toContain("Confirm new password");
  });
