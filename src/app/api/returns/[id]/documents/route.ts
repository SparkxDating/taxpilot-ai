import { NextResponse } from "next/server";
import { authed, loadOwnedReturn } from "../../../_util";
import { prisma } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await authed();
  if (!session) return error;
  const { id } = await params;
  const found = await loadOwnedReturn(id, session.userId, session.role);
  if (!found.ret) return found.error;
  const documents = await prisma.document.findMany({ where: { returnId: id }, include: { extractions: true } });
  return NextResponse.json({ documents });
}

export async function POST() {
  return NextResponse.json({ use: "multipart form via uploadDocumentAction" });
}
