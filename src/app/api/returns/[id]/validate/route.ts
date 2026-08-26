import { NextResponse } from "next/server";
import { authed, loadOwnedReturn } from "../../../_util";
import { loadNormalized } from "@/lib/tax/load";
import { validateReturn, validateAgainstOfficialSchema } from "@/lib/tax/validation";
import { generateITRJson } from "@/lib/itr-json/mapper";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await authed();
  if (!session) return error;
  const { id } = await params;
  const found = await loadOwnedReturn(id, session.userId, session.role);
  if (!found.ret) return found.error;
  const data = await loadNormalized(id);
  if (!data) return NextResponse.json({ error: "empty" }, { status: 400 });
  const field = validateReturn(data);
  const generated = generateITRJson(data);
  const schema = validateAgainstOfficialSchema(generated.json, data.assessmentYear, data.itrType);
  return NextResponse.json({ issues: field.issues, schema });
}
