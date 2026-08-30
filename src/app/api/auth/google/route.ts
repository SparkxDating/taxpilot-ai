import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  GOOGLE_STATE_COOKIE,
  buildGoogleAuthorizeUrl,
  createGoogleState,
  googleClientId,
  googleRedirectUri,
  isGoogleConfigured,
} from "@/lib/google-auth";

export async function GET() {
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL("/login?error=google", process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3002"));
  }
  const redirectUri = googleRedirectUri();
  const clientId = googleClientId();
  if (!redirectUri || !clientId) {
    return NextResponse.redirect(new URL("/login?error=google", process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3002"));
  }
  const state = createGoogleState();
  const jar = await cookies();
  jar.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(buildGoogleAuthorizeUrl({ clientId, redirectUri, state }));
}
