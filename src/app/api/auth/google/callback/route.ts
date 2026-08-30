import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  GOOGLE_STATE_COOKIE,
  completeGoogleLoginWith,
  exchangeGoogleCode,
  googleRedirectUri,
  googleStateMatches,
  prismaGoogleAuthStore,
  verifyGoogleIdToken,
} from "@/lib/google-auth";

function fail() {
  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3002";
  return NextResponse.redirect(new URL("/login?error=google", origin));
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code") || "";
  const state = request.nextUrl.searchParams.get("state") || "";
  const providerError = request.nextUrl.searchParams.get("error");
  const jar = await cookies();
  const expected = jar.get(GOOGLE_STATE_COOKIE)?.value || "";
  jar.delete(GOOGLE_STATE_COOKIE);
  if (providerError || !code || !googleStateMatches(expected, state)) return fail();
  try {
    const idToken = await exchangeGoogleCode(code, googleRedirectUri());
    const identity = await verifyGoogleIdToken(idToken);
    const result = await completeGoogleLoginWith(prismaGoogleAuthStore(prisma, hashPassword), identity, {
      email: request.nextUrl.searchParams.get("email") || "",
      userId: request.nextUrl.searchParams.get("userId") || "",
    });
    if (!result.ok) return fail();
    await createSession(result.userId);
    await audit({ userId: result.userId, action: "login", entity: "User", entityId: result.userId }).catch(() => undefined);
    const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    return NextResponse.redirect(new URL("/dashboard", origin));
  } catch {
    return fail();
  }
}
