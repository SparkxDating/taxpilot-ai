import { NextResponse } from "next/server";
import { authed, loadOwnedReturn } from "../../../_util";
import { recomputeReturn } from "@/lib/tax/persist";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await authed();
  if (!session) return error;
  const { id } = await params;
  const found = await loadOwnedReturn(id, session.userId, session.role);
  if (!found.ret) return found.error;
  const result = await recomputeReturn(id);
  return NextResponse.json({ eligibility: result?.eligibility, itrType: result?.updated.itrType });
}
