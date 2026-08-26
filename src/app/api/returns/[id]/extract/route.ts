import { NextResponse } from "next/server";
import { authed, loadOwnedReturn } from "../../../_util";
import { prisma } from "@/lib/db";
import { getOcrProvider } from "@/lib/providers/ocr";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await authed();
  if (!session) return error;
  const { id } = await params;
  const found = await loadOwnedReturn(id, session.userId, session.role);
  if (!found.ret) return found.error;
  const ocr = getOcrProvider();
  const docs = await prisma.document.findMany({ where: { returnId: id } });
  return NextResponse.json({ configured: ocr.configured, documents: docs.length });
}
