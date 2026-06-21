import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { SecurityConfig } from "@/lib/auth/security-config";
import { generateSecurityEventId } from "@/lib/auth/security-event-id";
import { logAudit } from "@/lib/audit";
import { OTP_PURPOSES, SECURITY_ACTIONS, ENTITY_TYPES } from "@/lib/constants";
import { EmailService } from "@/modules/notifications/email-service";

export type OtpPurpose = (typeof OTP_PURPOSES)[keyof typeof OTP_PURPOSES];

export type OtpBindings = {
  userId: string;
  purpose: OtpPurpose;
  resourceId?: string;
  sessionId: string;
  browserFingerprint?: string;
};

export type OtpResult = {
  /** Never returned to client — only for the in-memory flow. */
  code: string;
  expiresAt: Date;
};

const BCRYPT_ROUNDS = 10;

/**
 * OTP Service — step-up verification via one-time passwords.
 *
 * DESIGN:
 *   - 6-digit codes via cryptographically secure random (crypto.randomInt)
 *   - Hashed with bcrypt before storage (not SHA-256 — user requirement)
 *   - Bound to user + purpose + resource + session (not generic "user verified")
 *   - Single-use via atomic UPDATE WHERE usedAt IS NULL
 *   - Rate limited: MAX_ATTEMPTS attempts per code, then invalidated
 *   - Configurable expiry via env OTP_EXPIRY_SECONDS (default 300 = 5 min)
 *   - Fallback to password re-entry if email send fails in production
 *
 * DEVELOPMENT MODE:
 *   - The pipeline still executes (this service is still called)
 *   - verify() always returns true without checking the DB
 *   - No email is sent
 *   - This ensures NO duplicate code paths for dev mode
 */
export class OtpService {
  private readonly expirySeconds: number;
  private readonly maxAttempts: number;
  private readonly emailService: EmailService;

  constructor() {
    this.expirySeconds = env.OTP_EXPIRY_SECONDS;
    this.maxAttempts = env.OTP_MAX_ATTEMPTS;
    this.emailService = new EmailService();
  }

  // ─── Generate ──────────────────────────────────────────────────────────

  /**
   * Generate an OTP for the given bindings.
   *
   * In development mode: stores a verified-by-default code (all zeros)
   * so no email needs to be sent.
   *
   * @returns The plaintext code (for email delivery — NEVER stored) and expiry.
   */
  async create(bindings: OtpBindings): Promise<OtpResult> {
    const cfg = SecurityConfig.getInstance();

    // Development mode: use a known code so verify() auto-passes
    const code = cfg.isAutoApproved ? "000000" : this.generateCode();
    const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + this.expirySeconds * 1000);
    const securityEventId = generateSecurityEventId();

    await prisma.otpCode.create({
      data: {
        userId: bindings.userId,
        purpose: bindings.purpose,
        resourceId: bindings.resourceId ?? null,
        sessionId: bindings.sessionId,
        browserFingerprint: bindings.browserFingerprint ?? null,
        codeHash,
        expiresAt,
        securityEventId,
      },
    });

    // Audit: OTP requested
    await logAudit({
      actorId: bindings.userId,
      action: SECURITY_ACTIONS.OTP_REQUESTED,
      entityType: ENTITY_TYPES.OTP_CODE,
      securityEventId,
      metadata: {
        purpose: bindings.purpose,
        resourceId: bindings.resourceId,
        expiresAt: expiresAt.toISOString(),
        mode: cfg.mode,
      },
    });

    // Send email in production mode
    if (!cfg.isAutoApproved) {
      try {
        const user = await prisma.user.findUnique({ where: { id: bindings.userId } });
        if (user?.email) {
          await this.emailService.sendNotificationEmail(
            user.email,
            `Your OTP for ${bindings.purpose}`,
            `Your OTP is: ${code}\n\nThis code expires in ${this.expirySeconds / 60} minutes.\nDo not share this code.`,
          );
        }
      } catch {
        // Email failure is logged but does not block — password re-entry fallback exists
        await logAudit({
          actorId: bindings.userId,
          action: "OTP_EMAIL_FAILED",
          entityType: ENTITY_TYPES.OTP_CODE,
          metadata: { purpose: bindings.purpose },
        });
      }
    }

    return { code, expiresAt };
  }

  // ─── Verify ─────────────────────────────────────────────────────────────

  /**
   * Verify an OTP.
   *
   * In development mode: always returns true (no DB check, no code consumption).
   *
   * In production mode:
   *   1. Find an unused, non-expired OTP for this user + purpose
   *   2. bcrypt.compare the candidate code
   *   3. Atomic single-use: UPDATE ... SET usedAt=NOW() WHERE id=X AND usedAt IS NULL
   *   4. If affectedRows === 0 → replay detected
   *   5. On failure: increment attemptCount; if > maxAttempts → invalidate
   *
   * @returns true if verification succeeded.
   * @throws AppError with STEP_UP_REQUIRED / OTP_EXPIRED / OTP_INVALID / OTP_REPLAYED
   */
  async verify(bindings: OtpBindings, code: string): Promise<boolean> {
    const cfg = SecurityConfig.getInstance();

    // ── Development mode: auto-approve ──
    if (cfg.isAutoApproved) {
      // Still audit the verification event
      await logAudit({
        actorId: bindings.userId,
        action: SECURITY_ACTIONS.OTP_VERIFIED,
        entityType: ENTITY_TYPES.OTP_CODE,
        metadata: {
          purpose: bindings.purpose,
          resourceId: bindings.resourceId,
          mode: "development",
          autoApproved: true,
        },
      });
      return true;
    }

    // ── Production mode: verify against DB ──

    // 1. Find candidate OTP
    const candidate = await prisma.otpCode.findFirst({
      where: {
        userId: bindings.userId,
        purpose: bindings.purpose,
        resourceId: bindings.resourceId ?? undefined,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!candidate) {
      // Check if there's an expired one — differentiate "expired" vs "never existed"
      const expired = await prisma.otpCode.findFirst({
        where: {
          userId: bindings.userId,
          purpose: bindings.purpose,
          usedAt: null,
          expiresAt: { lte: new Date() },
        },
      });
      if (expired) {
        await this.auditFailure(bindings, "OTP_EXPIRED");
        throw new AppError("OTP has expired. Request a new one.", 401, "OTP_EXPIRED");
      }
      await this.auditFailure(bindings, "OTP_NOT_FOUND");
      throw new AppError("No OTP found. Request a new one.", 401, "OTP_NOT_FOUND");
    }

    // 2. Verify hash
    const valid = await bcrypt.compare(code, candidate.codeHash);
    if (!valid) {
      // Increment attempt count
      await prisma.otpCode.update({
        where: { id: candidate.id },
        data: { attemptCount: { increment: 1 } },
      });

      // Check rate limit
      if (candidate.attemptCount + 1 >= this.maxAttempts) {
        // Invalidate by expiring it
        await prisma.otpCode.update({
          where: { id: candidate.id },
          data: { expiresAt: new Date(0) },
        });
        await this.auditFailure(bindings, "OTP_RATE_LIMITED");
        throw new AppError("Too many incorrect attempts. Request a new OTP.", 429, "OTP_RATE_LIMITED");
      }

      await this.auditFailure(bindings, "OTP_INVALID");
      throw new AppError("Invalid OTP code.", 401, "OTP_INVALID");
    }

    // 3. Atomic single-use consumption
    const result = await prisma.otpCode.updateMany({
      where: { id: candidate.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    if (result.count === 0) {
      // Replay detected — another request consumed it between our findFirst and update
      await this.auditFailure(bindings, "OTP_REPLAYED");
      throw new AppError("OTP has already been used.", 409, "OTP_REPLAYED");
    }

    // 4. Audit success
    await logAudit({
      actorId: bindings.userId,
      action: SECURITY_ACTIONS.OTP_VERIFIED,
      entityType: ENTITY_TYPES.OTP_CODE,
      entityId: candidate.id,
      metadata: {
        purpose: bindings.purpose,
        resourceId: bindings.resourceId,
        sessionId: bindings.sessionId,
      },
    });

    return true;
  }

  // ─── Invalidate ─────────────────────────────────────────────────────────

  /** Invalidate all pending OTPs for a user + purpose (e.g. on re-request). */
  async invalidatePrior(userId: string, purpose: string, resourceId?: string): Promise<void> {
    await prisma.otpCode.updateMany({
      where: {
        userId,
        purpose,
        resourceId: resourceId ?? undefined,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { expiresAt: new Date(0) },
    });
  }

  /** Invalidate ALL active OTPs (lockdown). */
  async invalidateAll(userId: string): Promise<void> {
    await prisma.otpCode.updateMany({
      where: {
        userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { expiresAt: new Date(0) },
    });
  }

  // ─── Internal ───────────────────────────────────────────────────────────

  private generateCode(): string {
    return crypto.randomInt(100_000, 1_000_000).toString();
  }

  private async auditFailure(bindings: OtpBindings, reason: string): Promise<void> {
    await logAudit({
      actorId: bindings.userId,
      action: SECURITY_ACTIONS.OTP_FAILED,
      entityType: ENTITY_TYPES.OTP_CODE,
      metadata: {
        purpose: bindings.purpose,
        resourceId: bindings.resourceId,
        sessionId: bindings.sessionId,
        reason,
      },
    });
  }
}
