import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAudit as logAuditRaw } from "@/lib/audit";
import { ENTITY_TYPES, SECURITY_ACTIONS } from "@/lib/constants";
import { AppError } from "@/lib/errors";

export type AuditEventInput = {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  resourceId?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * Reusable Audit Service for security events.
 *
 * Wraps the low-level logAudit() with typed event helpers, chain verification,
 * and query capabilities for the Security Dashboard.
 *
 * Every security-sensitive action in the system should produce an audit event
 * via this service.
 */
export class AuditService {
  // ─── Typed event helpers ────────────────────────────────────────────────

  async otpRequested(input: Omit<AuditEventInput, "action" | "entityType">): Promise<void> {
    return this.log({ ...input, action: SECURITY_ACTIONS.OTP_REQUESTED, entityType: ENTITY_TYPES.OTP_CODE });
  }

  async otpVerified(input: Omit<AuditEventInput, "action" | "entityType">): Promise<void> {
    return this.log({ ...input, action: SECURITY_ACTIONS.OTP_VERIFIED, entityType: ENTITY_TYPES.OTP_CODE });
  }

  async otpFailed(input: Omit<AuditEventInput, "action" | "entityType">): Promise<void> {
    return this.log({ ...input, action: SECURITY_ACTIONS.OTP_FAILED, entityType: ENTITY_TYPES.OTP_CODE });
  }

  async paperRevealed(input: Omit<AuditEventInput, "action" | "entityType">): Promise<void> {
    return this.log({ ...input, action: SECURITY_ACTIONS.PAPER_REVEALED, entityType: ENTITY_TYPES.GENERATED_PAPER });
  }

  async paperDownloaded(input: Omit<AuditEventInput, "action" | "entityType">): Promise<void> {
    return this.log({ ...input, action: SECURITY_ACTIONS.PAPER_DOWNLOADED, entityType: ENTITY_TYPES.PAPER_DOWNLOAD });
  }

  async paperRegenerated(input: Omit<AuditEventInput, "action" | "entityType">): Promise<void> {
    return this.log({ ...input, action: SECURITY_ACTIONS.PAPER_REGENERATED, entityType: ENTITY_TYPES.GENERATED_PAPER });
  }

  async paperApproved(input: Omit<AuditEventInput, "action" | "entityType">): Promise<void> {
    return this.log({ ...input, action: SECURITY_ACTIONS.PAPER_APPROVED, entityType: ENTITY_TYPES.DEAN_REVIEW });
  }

  async paperMarkedUsed(input: Omit<AuditEventInput, "action" | "entityType">): Promise<void> {
    return this.log({ ...input, action: SECURITY_ACTIONS.PAPER_MARKED_USED, entityType: ENTITY_TYPES.GENERATED_PAPER });
  }

  async questionsRevealed(input: Omit<AuditEventInput, "action" | "entityType">): Promise<void> {
    return this.log({ ...input, action: SECURITY_ACTIONS.QUESTIONS_REVEALED, entityType: ENTITY_TYPES.QUESTION });
  }

  async emergencyOverride(input: Omit<AuditEventInput, "action" | "entityType">): Promise<void> {
    return this.log({ ...input, action: SECURITY_ACTIONS.EMERGENCY_OVERRIDE, entityType: ENTITY_TYPES.SECURITY_EVENT });
  }

  // ─── Core log method ────────────────────────────────────────────────────

  /**
   * Log an audit event. Delegates to the existing hash-chained logAudit().
   * This method enriches the input with the request IP and user-agent from context.
   */
  async log(input: AuditEventInput): Promise<void> {
    await logAuditRaw({
      actorId: input.actorId ?? undefined,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? undefined,
      metadata: {
        ...input.metadata,
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
        ...(input.resourceId ? { resourceId: input.resourceId } : {}),
      },
      ipAddress: input.ipAddress ?? undefined,
      userAgent: input.userAgent ?? undefined,
    });
  }

  // ─── Chain verification ─────────────────────────────────────────────────

  /**
   * Walk the entire audit hash chain and verify integrity.
   *
   * @returns Array of chain breaks found. Empty array = chain is intact.
   */
  async verifyChain(): Promise<ChainBreak[]> {
    const entries = await prisma.auditLog.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        previousHash: true,
        integrityHash: true,
        actorId: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        ipAddress: true,
        userAgent: true,
        sessionId: true,
        createdAt: true,
      },
    });

    const breaks: ChainBreak[] = [];
    let expectedPreviousHash: string | null = null;

    for (const entry of entries) {
      // Verify link: this entry's previousHash should match the expected hash
      if (entry.previousHash !== expectedPreviousHash) {
        breaks.push({
          entryId: entry.id,
          type: "CHAIN_BREAK",
          expected: expectedPreviousHash,
          actual: entry.previousHash,
          createdAt: entry.createdAt,
          action: entry.action,
        });
      }

      // Recompute the hash and verify it matches
      const recomputed = recomputeIntegrityHash(entry);
      if (recomputed !== entry.integrityHash) {
        breaks.push({
          entryId: entry.id,
          type: "HASH_MISMATCH",
          expected: recomputed,
          actual: entry.integrityHash,
          createdAt: entry.createdAt,
          action: entry.action,
        });
      }

      expectedPreviousHash = entry.integrityHash;
    }

    return breaks;
  }

  // ─── Dashboard queries ──────────────────────────────────────────────────

  /** Get recent security events for the COE Security Dashboard. */
  async getRecentEvents(limit = 50): Promise<SecurityEventItem[]> {
    const entries = await prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            SECURITY_ACTIONS.OTP_REQUESTED,
            SECURITY_ACTIONS.OTP_VERIFIED,
            SECURITY_ACTIONS.OTP_FAILED,
            SECURITY_ACTIONS.PAPER_REVEALED,
            SECURITY_ACTIONS.PAPER_DOWNLOADED,
            SECURITY_ACTIONS.PAPER_REGENERATED,
            SECURITY_ACTIONS.PAPER_APPROVED,
            SECURITY_ACTIONS.PAPER_MARKED_USED,
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
    });

    return entries.map((e) => ({
      id: e.id,
      action: e.action,
      actor: e.actor ? { name: e.actor.name, email: e.actor.email } : null,
      metadata: e.metadata as Record<string, unknown> | null,
      ipAddress: e.ipAddress,
      createdAt: e.createdAt,
    }));
  }

  /** Get failed OTP attempts count in a time window. */
  async getFailedOtpCount(since: Date): Promise<number> {
    return prisma.auditLog.count({
      where: {
        action: SECURITY_ACTIONS.OTP_FAILED,
        createdAt: { gte: since },
      },
    });
  }

  /** Get download count in a time window. */
  async getDownloadCount(since: Date): Promise<number> {
    return prisma.auditLog.count({
      where: {
        action: SECURITY_ACTIONS.PAPER_DOWNLOADED,
        createdAt: { gte: since },
      },
    });
  }
}

// ─── Types ────────────────────────────────────────────────────────────────

export type ChainBreak = {
  entryId: string;
  type: "CHAIN_BREAK" | "HASH_MISMATCH";
  expected: string | null;
  actual: string | null;
  createdAt: Date;
  action: string;
};

export type SecurityEventItem = {
  id: string;
  action: string;
  actor: { name: string; email: string } | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: Date;
};

// ─── Hash recomputation (mirrors src/lib/audit.ts logic) ──────────────────

type AuditRow = {
  id: string;
  previousHash: string | null;
  integrityHash: string | null;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  sessionId: string | null;
  createdAt: Date;
};

function recomputeIntegrityHash(entry: AuditRow): string {
  const payload = JSON.stringify({
    actorId: entry.actorId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    metadata: entry.metadata ?? null,
    ipAddress: entry.ipAddress ?? null,
    userAgent: entry.userAgent ?? null,
    sessionId: entry.sessionId ?? null,
    previousHash: entry.previousHash ?? null,
  });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

/**
 * Convenience function to extract IP and user-agent from request headers.
 */
export function extractRequestMeta(request: Request): { ipAddress: string | null; userAgent: string | null } {
  return {
    ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null,
    userAgent: request.headers.get("user-agent") ?? null,
  };
}

/**
 * Convenience function to create a singleton AuditService.
 */
let auditServiceInstance: AuditService | null = null;
export function getAuditService(): AuditService {
  if (!auditServiceInstance) {
    auditServiceInstance = new AuditService();
  }
  return auditServiceInstance;
}
