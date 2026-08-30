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

  it("calls the email sender for an existing account with subject, URL, and expiry copy", async () => {
    const passwordHash = await bcryptHash(OLD_PASSWORD, 12);
    const mem = createMemoryStore({ email: "mail@taxpilot.test", passwordHash });
    const result = await requestPasswordResetWith(mem.store, "mail@taxpilot.test");
    expect(result.message).toBe(GENERIC_RESET_MESSAGE);
    expect(mem.emails).toHaveLength(1);
    const sent = mem.emails[0]!;
    expect(sent.to).toBe("mail@taxpilot.test");
    expect(sent.subject).toBe(RESET_EMAIL_SUBJECT);
    expect(sent.text).toContain("We received a request to reset your TaxPilot password.");
    expect(sent.text).toContain("This link expires in 1 hour.");
    expect(sent.text).toContain("/reset-password?token=");
    expect(sent.text.includes(OLD_PASSWORD)).toBe(false);
    expect(sent.text.includes(NEW_PASSWORD)).toBe(false);
    const token = tokenFromUrl(takeDevResetUrl("mail@taxpilot.test"));
    expect(sent.text).toContain(token);
  });

  it("does not use the email sender to reveal an unknown account", async () => {
    const passwordHash = await bcryptHash(OLD_PASSWORD, 12);
    const mem = createMemoryStore({ email: "known@taxpilot.test", passwordHash });
    const result = await requestPasswordResetWith(mem.store, "missing@taxpilot.test");
    expect(result.message).toBe(GENERIC_RESET_MESSAGE);
    expect(mem.emails).toHaveLength(0);
    expect(mem.tokens.size).toBe(0);
  });

  it("does not claim an email was sent when production email configuration is missing", async () => {
    Reflect.set(process.env, "NODE_ENV", "production");
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.RESET_EMAIL_FROM;
    expect(isResetEmailConfigured()).toBe(false);
    const passwordHash = await bcryptHash(OLD_PASSWORD, 12);
    const mem = createMemoryStore({ email: "known@taxpilot.test", passwordHash });
    const existing = await requestPasswordResetWith(mem.store, "known@taxpilot.test");
    const unknown = await requestPasswordResetWith(mem.store, "missing@taxpilot.test");
    expect(existing.message).toBe(RESET_UNAVAILABLE_MESSAGE);
    expect(unknown.message).toBe(RESET_UNAVAILABLE_MESSAGE);
    expect(existing.message.includes("has been sent")).toBe(false);
    expect(mem.emails).toHaveLength(0);
    expect(mem.tokens.size).toBe(0);
    await expect(
      sendConfiguredResetEmail({
        to: "nobody@taxpilot.test",
        subject: RESET_EMAIL_SUBJECT,
        text: "reset",
      }),
    ).rejects.toThrow("email-not-configured");
  });

  it("does not generate a broken reset URL when the public app URL is missing", async () => {
    Reflect.set(process.env, "NODE_ENV", "production");
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
    expect(publicOrigin()).toBe("");
    expect(isValidPublicOrigin("")).toBe(false);
    expect(isValidPublicOrigin("http://localhost:3002")).toBe(false);
    expect(isValidPublicOrigin("http://127.0.0.1:3002")).toBe(false);
    expect(isValidPublicOrigin("https://app.taxpilot.test")).toBe(true);
    expect(canSendProductionResetEmail("")).toBe(false);
    const passwordHash = await bcryptHash(OLD_PASSWORD, 12);
    const mem = createMemoryStore({ email: "url@taxpilot.test", passwordHash });
    const result = await requestPasswordResetWith(mem.store, "url@taxpilot.test");
    expect(result.message).toBe(RESET_UNAVAILABLE_MESSAGE);
    expect(mem.emails).toHaveLength(0);
    expect(takeDevResetUrl("url@taxpilot.test")).toBeUndefined();
    for (const payload of mem.emails) {
      expect(payload.text.includes("localhost")).toBe(false);
      expect(payload.text.includes("127.0.0.1")).toBe(false);
    }
  });

  it("posts to Resend with recipient, subject, and reset URL when configured", async () => {
    const resetUrl = "https://app.taxpilot.test/reset-password?token=test-token";
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; authorization: string; body: { from: string; to: string[]; subject: string; text: string } }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(input),
        authorization: headers.get("Authorization") || "",
        body: JSON.parse(String(init?.body || "{}")),
      });
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    try {
      await sendConfiguredResetEmail({
        to: "mail@taxpilot.test",
        subject: RESET_EMAIL_SUBJECT,
        text: composeResetEmail(resetUrl).text,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.resend.com/emails");
    expect(calls[0]!.authorization.startsWith("Bearer ")).toBe(true);
    expect(calls[0]!.body.from).toBe("TaxPilot <noreply@taxpilot.test>");
    expect(calls[0]!.body.to).toEqual(["mail@taxpilot.test"]);
    expect(calls[0]!.body.subject).toBe(RESET_EMAIL_SUBJECT);
    expect(calls[0]!.body.text).toContain("https://app.taxpilot.test/reset-password?token=");
    expect(calls[0]!.body.text).toContain("This link expires in 1 hour.");
    expect(calls[0]!.body.text.includes(OLD_PASSWORD)).toBe(false);
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
    expect(next.includes(NEW_PASSWORD)).toBe(false);
    expect(await bcryptCompare(NEW_PASSWORD, next)).toBe(true);
    expect(await bcryptCompare(OLD_PASSWORD, next)).toBe(false);
    expect(mem.returns.get("user-1")).toEqual(["return-1"]);
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(stored!.usedAt).toBeTruthy();
  });

  it("lets the new password authenticate and rejects the old password", async () => {
    const passwordHash = await bcryptHash(OLD_PASSWORD, 12);
    const mem = createMemoryStore({ email: "login@taxpilot.test", passwordHash });
    await requestPasswordResetWith(mem.store, "login@taxpilot.test");
    const token = tokenFromUrl(takeDevResetUrl("login@taxpilot.test"));
    const result = await completePasswordResetWith(mem.store, {
      token,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });
    expect(result.ok).toBe(true);
    const next = mem.passwords.get("user-1")!;
    expect(await bcryptCompare(NEW_PASSWORD, next)).toBe(true);
    expect(await bcryptCompare(OLD_PASSWORD, next)).toBe(false);
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

  it("does not consume the token if password update fails", async () => {
    const passwordHash = await bcryptHash(OLD_PASSWORD, 12);
    const mem = createMemoryStore({ email: "fail@taxpilot.test", passwordHash });
    await requestPasswordResetWith(mem.store, "fail@taxpilot.test");
    const token = tokenFromUrl(takeDevResetUrl("fail@taxpilot.test"));
    const stored = [...mem.tokens.values()][0]!;
    mem.store.updatePassword = async () => {
      throw new Error("password update failed");
    };

    const failed = await completePasswordResetWith(mem.store, {
      token,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });
    expect(failed.ok).toBe(false);
    expect(stored.usedAt).toBeNull();
    expect(mem.passwords.get("user-1")).toBe(passwordHash);

    mem.store.updatePassword = async (userId, nextHash) => {
      mem.passwords.set(userId, nextHash);
    };
    const retried = await completePasswordResetWith(mem.store, {
      token,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });
    expect(retried.ok).toBe(true);
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
    expect(mem.emails).toHaveLength(1);

    clearPasswordResetRateLimit();
    await requestPasswordResetWith(mem.store, "rate@taxpilot.test", { ip: "203.0.113.9" });
    const blocked = await requestPasswordResetWith(mem.store, "missing@taxpilot.test", { ip: "203.0.113.9" });
    expect(blocked.message).toBe(GENERIC_RESET_MESSAGE);
    expect(mem.tokens.size).toBe(2);
    expect(mem.emails).toHaveLength(2);
  });
});
