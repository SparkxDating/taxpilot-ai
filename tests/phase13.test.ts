import { createHash, randomBytes } from "node:crypto";
import { hash as bcryptHash, compare as bcryptCompare } from "bcryptjs";
import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  GENERIC_RESET_MESSAGE,
  INVALID_TOKEN_MESSAGE,
  MIN_PASSWORD_LENGTH,
  RESET_EMAIL_SUBJECT,
  TOKEN_TTL_MS,
  type PasswordResetStore,
  type ResetTokenRow,
  clearPasswordResetRateLimit,
  completePasswordResetWith,
  composeResetEmail,
  generateResetToken,
  hashLooksHashed,
  hashResetToken,
  requestPasswordResetWith,
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
  };

  return { store, tokens, passwords, returns };
}

describe("Phase 13 password reset", () => {
  beforeEach(() => {
    clearPasswordResetRateLimit();
  });

  it("login page has a Forgot password link to the reset request page", () => {
    const login = readFileSync(join(process.cwd(), "src/app/login/page.tsx"), "utf8");
    expect(login).toContain("Forgot password?");
    expect(login).toContain('href="/forgot-password"');
    const forgot = readFileSync(join(process.cwd(), "src/app/forgot-password/page.tsx"), "utf8");
    expect(forgot).toContain("requestPasswordResetAction");
    expect(forgot).toContain("GENERIC_RESET_MESSAGE");
    const reset = readFileSync(join(process.cwd(), "src/app/reset-password/page.tsx"), "utf8");
    expect(reset).toContain("completePasswordResetAction");
    expect(reset).toContain("Confirm new password");
  });

  it("hashes reset tokens and never treats plaintext as a stored secret", () => {
    const token = generateResetToken();
    const hashed = hashResetToken(token);
    expect(hashed).toBe(createHash("sha256").update(token).digest("hex"));
    expect(hashed).not.toBe(token);
    expect(hashLooksHashed(hashed, token)).toBe(true);
  });

  it("returns the same generic message for existing and unknown emails", async () => {
    const passwordHash = await bcryptHash(OLD_PASSWORD, 12);
    const known = createMemoryStore({ email: "known@taxpilot.test", passwordHash });
    const knownRes = await requestPasswordResetWith(known.store, "known@taxpilot.test");
    const unknownRes = await requestPasswordResetWith(known.store, "missing@taxpilot.test");
    expect(knownRes.message).toBe(GENERIC_RESET_MESSAGE);
    expect(unknownRes.message).toBe(GENERIC_RESET_MESSAGE);
    expect(knownRes.message).toBe(unknownRes.message);
    expect(takeDevResetUrl("known@taxpilot.test")).toBeTruthy();
    expect(takeDevResetUrl("missing@taxpilot.test")).toBeUndefined();
    expect([...known.tokens.keys()][0]?.includes("?token=")).toBe(false);
  });

  it("composes the reset email without the password and with a 1-hour warning", () => {
    const email = composeResetEmail("https://example.com/reset-password?token=abc");
    expect(email.subject).toBe(RESET_EMAIL_SUBJECT);
    expect(email.text).toContain("We received a request to reset your TaxPilot password.");
    expect(email.text).toContain("Use the link below to create a new password.");
    expect(email.text).toContain("This link expires in 1 hour.");
    expect(email.text).toContain("If you did not request this, you can ignore this email.");
    expect(email.text).toContain("https://example.com/reset-password?token=abc");
    expect(email.text.includes(OLD_PASSWORD)).toBe(false);
    expect(email.text.includes(NEW_PASSWORD)).toBe(false);
  });

  it("changes the password with a valid token and keeps return rows intact", async () => {
    const passwordHash = await bcryptHash(OLD_PASSWORD, 12);
    const mem = createMemoryStore({ email: "reset@taxpilot.test", passwordHash });
    await requestPasswordResetWith(mem.store, "reset@taxpilot.test");
    const stored = [...mem.tokens.values()][0];
    expect(stored).toBeTruthy();
    expect(stored!.expiresAt.getTime() - Date.now()).toBeGreaterThan(50 * 60 * 1000);
    expect(stored!.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(TOKEN_TTL_MS);

    const token = tokenFromUrl(takeDevResetUrl("reset@taxpilot.test"));
    expect(stored!.token).toBe(hashResetToken(token));
    const result = await completePasswordResetWith(mem.store, {
      token,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });
    expect(result.ok).toBe(true);
    const next = mem.passwords.get("user-1")!;
    expect(hashLooksHashed(next, NEW_PASSWORD)).toBe(true);
    expect(await bcryptCompare(NEW_PASSWORD, next)).toBe(true);
    expect(await bcryptCompare(OLD_PASSWORD, next)).toBe(false);
    expect(mem.returns.get("user-1")).toEqual(["return-1"]);
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });

  it("blocks expired, invalid, and reused tokens", async () => {
    const passwordHash = await bcryptHash(OLD_PASSWORD, 12);
    const mem = createMemoryStore({ email: "reuse@taxpilot.test", passwordHash });

    const expiredToken = generateResetToken();
    await mem.store.createToken({
      userId: "user-1",
      tokenHash: hashResetToken(expiredToken),
      expiresAt: new Date(Date.now() - 60_000),
    });
    const expired = await completePasswordResetWith(mem.store, {
      token: expiredToken,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });
    expect(expired.ok).toBe(false);
    if (!expired.ok) expect(expired.error).toBe(INVALID_TOKEN_MESSAGE);

    const invalid = await completePasswordResetWith(mem.store, {
      token: "this-token-is-not-real",
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error).toBe(INVALID_TOKEN_MESSAGE);

    await requestPasswordResetWith(mem.store, "reuse@taxpilot.test");
    const token = tokenFromUrl(takeDevResetUrl("reuse@taxpilot.test"));
    const first = await completePasswordResetWith(mem.store, {
      token,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });
    expect(first.ok).toBe(true);
    const reused = await completePasswordResetWith(mem.store, {
      token,
      newPassword: "another-password-789",
      confirmPassword: "another-password-789",
    });
    expect(reused.ok).toBe(false);
    if (!reused.ok) expect(reused.error).toBe(INVALID_TOKEN_MESSAGE);
    expect(await bcryptCompare(NEW_PASSWORD, mem.passwords.get("user-1")!)).toBe(true);
  });

  it("rate-limits repeated reset requests for the same email or IP", async () => {
    const passwordHash = await bcryptHash(OLD_PASSWORD, 12);
    const mem = createMemoryStore({ email: "rate@taxpilot.test", passwordHash });
    const first = await requestPasswordResetWith(mem.store, "rate@taxpilot.test");
    const second = await requestPasswordResetWith(mem.store, "rate@taxpilot.test");
    expect(first.message).toBe(GENERIC_RESET_MESSAGE);
    expect(second.message).toBe(GENERIC_RESET_MESSAGE);
    expect(mem.tokens.size).toBe(1);

    clearPasswordResetRateLimit();
    await requestPasswordResetWith(mem.store, "rate@taxpilot.test", { ip: "203.0.113.9" });
    const blocked = await requestPasswordResetWith(mem.store, "missing@taxpilot.test", { ip: "203.0.113.9" });
    expect(blocked.message).toBe(GENERIC_RESET_MESSAGE);
    expect(mem.tokens.size).toBe(2);
  });
});
