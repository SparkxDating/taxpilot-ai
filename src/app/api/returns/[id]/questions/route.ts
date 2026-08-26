import { NextResponse } from "next/server";
import { authed, loadOwnedReturn } from "../../../_util";
import { prisma } from "@/lib/db";
import { getAIProvider } from "@/lib/providers/ai";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await authed();
  if (!session) return error;
  const { id } = await params;
  const found = await loadOwnedReturn(id, session.userId, session.role);
  if (!found.ret) return found.error;
  const questions = await prisma.question.findMany({ where: { returnId: id }, orderBy: { sortOrder: "asc" }, include: { answers: true } });
  return NextResponse.json({ questions });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await authed();
  if (!session) return error;
  const { id } = await params;
  const found = await loadOwnedReturn(id, session.userId, session.role);
  if (!found.ret) return found.error;
  const body = await req.json();
  if (body.explain) {
    const text = await getAIProvider().explain(body.explain);
    return NextResponse.json({ explanation: text });
  }
  return NextResponse.json({ ok: true });
}
