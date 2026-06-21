import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const MAX_RETRIES = 3;

type AuditParams = {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
  securityEventId?: string;
};

async function createAuditEntryWithRetry(
  params: AuditParams,
  attempt = 1,
): Promise<unknown> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const previous = await tx.auditLog.findFirst({
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
          sessionId: params.sessionId ?? null,
          securityEventId: params.securityEventId ?? null,
          previousHash: previous?.integrityHash ?? null,
        });

        const integrityHash = crypto
          .createHash("sha256")
          .update(payload)
          .digest("hex");

        return tx.auditLog.create({
          data: {
            actorId: params.actorId ?? null,
            action: params.action,
            entityType: params.entityType,
            entityId: params.entityId ?? null,
            metadata: params.metadata as Prisma.InputJsonValue | undefined,
            ipAddress: params.ipAddress ?? null,
            userAgent: params.userAgent ?? null,
            sessionId: params.sessionId ?? null,
            securityEventId: params.securityEventId ?? null,
            previousHash: previous?.integrityHash ?? null,
            integrityHash,
          },
        });
      },
    );
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === "P2034" || err.code === "P4001") &&
      attempt < MAX_RETRIES
    ) {
      return createAuditEntryWithRetry(params, attempt + 1);
    }
    throw err;
  }
}

export async function logAudit(params: AuditParams) {
  return createAuditEntryWithRetry(params);
}
