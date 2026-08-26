import { NextResponse } from "next/server";
import { authed, loadOwnedReturn } from "../../_util";
import { prisma } from "@/lib/db";
import { recomputeReturn } from "@/lib/tax/persist";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await authed();
  if (!session) return error;
  const { id } = await params;
  const found = await loadOwnedReturn(id, session.userId, session.role);
  if (!found.ret) return found.error;
  const full = await prisma.taxReturn.findUnique({
    where: { id },
    include: { salary: true, business: true, professional: true, validationErrors: true, documents: true },
  });
  return NextResponse.json(full);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await authed();
  if (!session) return error;
  const { id } = await params;
  const found = await loadOwnedReturn(id, session.userId, session.role);
  if (!found.ret) return found.error;
  const body = await req.json();
  await prisma.taxReturn.update({
    where: { id },
    data: {
      taxRegime: body.taxRegime || undefined,
      taxpayerType: body.taxpayerType || undefined,
    },
  });
  await recomputeReturn(id);
  return NextResponse.json({ ok: true });
}
