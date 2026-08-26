import { prisma } from "./db";

export async function audit(input: {
  userId?: string | null;
  returnId?: string | null;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  const meta = { ...(input.metadata || {}) };
  delete meta.pan;
  delete meta.aadhaar;
  delete meta.password;
  await prisma.auditLog.create({
    data: {
      userId: input.userId || null,
      returnId: input.returnId || null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId || "",
      metadata: JSON.stringify(meta),
    },
  });
}
