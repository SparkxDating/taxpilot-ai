"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { clearSession, hashPassword } from "@/lib/auth";
import { requestPasswordResetWith, completePasswordResetWith, prismaPasswordResetStore } from "@/lib/password-reset";
import { rateLimit } from "@/lib/rate-limit";

function rethrowControl(error: unknown) {
  unstable_rethrow(error);
  if (error && typeof error === "object" && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) {
    throw error;
  }
}

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "";
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const ip = await clientIp();
  if (!rateLimit(`reset:${email}`, 1, 60_000).ok || (ip && !rateLimit(`reset-ip:${ip}`, 8, 60_000).ok)) {
    redirect("/forgot-password?sent=1");
  }
  try {
    const store = prismaPasswordResetStore({ prisma: prisma as never, hashPassword });
    await requestPasswordResetWith(store, email, { origin: process.env.NEXT_PUBLIC_APP_URL, ip });
  } catch (error) {
    rethrowControl(error);
    console.error("password reset request failed", error);
  }
  redirect("/forgot-password?sent=1");
}

export async function completePasswordResetAction(formData: FormData) {
  const token = String(formData.get("token") || "").trim();
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  try {
    const store = prismaPasswordResetStore({ prisma: prisma as never, hashPassword });
    const result = await completePasswordResetWith(store, { token, newPassword, confirmPassword });
    if (!result.ok) {
      const code = result.error === "Passwords do not match." ? "mismatch" : result.error.includes("at least") ? "short" : "invalid";
      if (code === "invalid" || !token) redirect("/reset-password?error=invalid");
      redirect(`/reset-password?token=${encodeURIComponent(token)}&error=${code}`);
    }
    await clearSession();
  } catch (error) {
    rethrowControl(error);
    console.error("password reset failed", error);
    redirect("/reset-password?error=invalid");
  }
  redirect("/login?reset=1");
}
