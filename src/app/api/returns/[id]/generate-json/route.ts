import { NextResponse } from "next/server";
import { authed, loadOwnedReturn } from "../../../_util";
import { loadNormalized } from "@/lib/tax/load";
import { generateITRJson } from "@/lib/itr-json/mapper";
import { prisma } from "@/lib/db";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { audit } from "@/lib/audit";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await authed();
  if (!session) return error;
  const { id } = await params;
  const found = await loadOwnedReturn(id, session.userId, session.role);
  if (!found.ret) return found.error;
  const data = await loadNormalized(id, session.role === "ADMIN" ? undefined : session.userId);
  if (!data) return NextResponse.json({ error: "empty" }, { status: 400 });
  if (data.itrType !== "ITR-4") {
    return NextResponse.json({ error: "ITR-3 filing JSON is not available yet." }, { status: 400 });
  }
  const result = generateITRJson(data, { returnId: id });
  if (!result.valid || !result.json) {
    return NextResponse.json({ error: "Unable to generate the return. Please correct the highlighted issues.", errors: result.errors }, { status: 400 });
  }
  const dir = path.join(process.cwd(), "storage", "json", id);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `ITR-4.json`);
  await writeFile(file, JSON.stringify(result.json, null, 2), "utf8");
  await prisma.iTRJsonFile.updateMany({ where: { returnId: id, status: "CURRENT" }, data: { status: "SUPERSEDED" } });
  const row = await prisma.iTRJsonFile.create({
    data: {
      returnId: id,
      assessmentYear: data.assessmentYear,
      itrType: "ITR-4",
      schemaVersion: result.schemaVersion,
      fileHash: result.digest,
      storagePath: file,
      valid: true,
      status: "CURRENT",
      versionId: result.digest.slice(0, 12),
    },
  });
  await prisma.taxReturn.update({ where: { id }, data: { status: "JSON_GENERATED", schemaVersion: result.schemaVersion } });
  await audit({ userId: session.userId, returnId: id, action: "json.generated", entity: "ITRJsonFile", entityId: row.id, metadata: { hash: result.digest } });
  return NextResponse.json({ id: row.id, valid: true, hash: result.digest });
}
