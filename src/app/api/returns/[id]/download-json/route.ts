import { authed, loadOwnedReturn } from "../../../_util";
import { prisma } from "@/lib/db";
import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { getUserAccess, proRequiredBody } from "@/lib/plan";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await authed();
  if (!session) return error;
  const { id } = await params;
  const found = await loadOwnedReturn(id, session.userId, session.role);
  if (!found.ret) return found.error;
  const access = await getUserAccess(session.userId);
  if (!access.isPro) return NextResponse.json(proRequiredBody(), { status: 403 });
  const file = await prisma.iTRJsonFile.findFirst({ where: { returnId: id, status: "CURRENT", itrType: "ITR-4" }, orderBy: { generatedAt: "desc" } });
  if (!file) return NextResponse.json({ error: "No JSON generated" }, { status: 404 });
  const buf = await readFile(file.storagePath);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${file.itrType}-${file.assessmentYear}.json"`,
    },
  });
}
