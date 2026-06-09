import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type AuditParams = {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function logAudit(params: AuditParams) {
  const previous = await prisma.auditLog.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { integrityHash: true },
  });

  const payload = JSON.stringify({
    actorId: params.actorId ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    metadata: params.metadata ?? null,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
    previousHash: previous?.integrityHash ?? null,
  });

  const integrityHash = crypto.createHash("sha256").update(payload).digest("hex");

  return prisma.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      previousHash: previous?.integrityHash ?? null,
      integrityHash,
    },
  });
}
