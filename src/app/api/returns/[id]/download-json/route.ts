import { authed, loadOwnedReturn } from "../../../_util";
import { prisma } from "@/lib/db";
import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await authed();
  if (!session) return error;
  const { id } = await params;
  const found = await loadOwnedReturn(id, session.userId, session.role);
  if (!found.ret) return found.error;
  const file = await prisma.iTRJsonFile.findFirst({ where: { returnId: id }, orderBy: { generatedAt: "desc" } });
  if (!file) return NextResponse.json({ error: "No JSON generated" }, { status: 404 });
  const buf = await readFile(file.storagePath);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${file.itrType}-${file.assessmentYear}.json"`,
    },
  });
}
