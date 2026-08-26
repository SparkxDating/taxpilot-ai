import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authed } from "../_util";
import { seedInterview } from "@/lib/interview";
import { recomputeReturn } from "@/lib/tax/persist";
import { audit } from "@/lib/audit";

export async function GET() {
  const { session, error } = await authed();
  if (!session) return error;
  const items = await prisma.taxReturn.findMany({
    where: session.role === "ADMIN" ? {} : { userId: session.userId },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const { session, error } = await authed();
  if (!session) return error;
  const body = await req.json();
  const ret = await prisma.taxReturn.create({
    data: {
      userId: session.userId,
      assessmentYear: body.assessmentYear || "2026-27",
      taxpayerType: body.taxpayerType || "INDIVIDUAL",
      incomeSourcesJson: JSON.stringify(body.sources || []),
    },
  });
  await seedInterview(ret.id, body.sources || []);
  await recomputeReturn(ret.id);
  await audit({ userId: session.userId, returnId: ret.id, action: "return.created", entity: "TaxReturn", entityId: ret.id });
  return NextResponse.json({ id: ret.id });
}
