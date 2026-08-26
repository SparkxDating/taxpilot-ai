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
  const result = generateITRJson(data);
  const dir = path.join(process.cwd(), "storage", "json", id);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${data.itrType}.json`);
  await writeFile(file, JSON.stringify(result.json, null, 2), "utf8");
  const row = await prisma.iTRJsonFile.create({
    data: {
      returnId: id,
      assessmentYear: data.assessmentYear,
      itrType: data.itrType,
      schemaVersion: result.schemaVersion,
      fileHash: result.digest,
      storagePath: file,
      valid: result.valid,
    },
  });
  await prisma.taxReturn.update({ where: { id }, data: { status: result.valid ? "JSON_READY" : "VALIDATION_FAILED" } });
  await audit({ userId: session.userId, returnId: id, action: "json.generated", entity: "ITRJsonFile", entityId: row.id });
  return NextResponse.json({ id: row.id, valid: result.valid, hash: result.digest });
}
