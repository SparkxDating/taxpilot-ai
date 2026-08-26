import { NextResponse } from "next/server";
import { authed } from "../../../_util";
import { prisma } from "@/lib/db";
import { getOcrProvider } from "@/lib/providers/ocr";
import { getStorage } from "@/lib/providers/storage";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await authed();
  if (!session) return error;
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc || (doc.userId !== session.userId && session.role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const bytes = await getStorage().get(doc.storageKey);
  const ocr = getOcrProvider();
  const candidates = await ocr.extract({ fileName: doc.fileName, mimeType: doc.mimeType, bytes });
  return NextResponse.json({ configured: ocr.configured, candidates });
}
