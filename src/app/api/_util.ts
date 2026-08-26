import { NextResponse } from "next/server";
import { getSession, canAccessReturn } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function authed() {
  const session = await getSession();
  if (!session) return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { session, error: null };
}

export async function loadOwnedReturn(id: string, userId: string, role: string) {
  const ret = await prisma.taxReturn.findUnique({ where: { id } });
  if (!ret) return { ret: null, error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!canAccessReturn(ret.userId, { userId, role })) {
    return { ret: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ret, error: null };
}
