import { prisma } from "@/lib/db";
import { SecurityConfig, SecurityMode } from "@/lib/auth/security-config";
import { StepUpService } from "@/lib/auth/step-up-service";
import { OtpService } from "@/lib/auth/otp-service";
import { getAuditService } from "@/lib/auth/audit-service";
import { SECURITY_ACTIONS, ENTITY_TYPES } from "@/lib/constants";
import { AppError } from "@/lib/errors";

/**
 * Emergency/Lockdown Service.
 *
 * Provides centralized control for emergency security measures.
 * All actions are audited and require COE-level authorization.
 *
 * ARCHITECTURE NOTE: This service is designed now but lockdown mode
 * (SecurityMode.LOCKDOWN) is reserved for future full implementation.
 * The individual actions work in both production and development modes.
 */
export class EmergencyService {
  /**
   * Activate lockdown mode.
   * - Revokes all active OTPs for all users
   * - Clears all step-up sessions
   * - Prevents new downloads (handled by SecurityConfig)
   * - Prevents paper reveals (handled by SecurityConfig)
   * - Creates emergency audit event
   */
  async activateLockdown(actorId: string): Promise<void> {
    const cfg = SecurityConfig.getInstance();

    // Revoke all active OTPs
    await prisma.otpCode.updateMany({
      where: {
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { expiresAt: new Date(0) },
    });

    // Clear all step-up sessions
    const stepUpService = new StepUpService();
    stepUpService.clearAll();

    // Set lockdown mode in SecurityConfig
    await cfg.set("SECURITY_MODE", SecurityMode.LOCKDOWN, actorId);

    // Emergency audit event
    const audit = getAuditService();
    await audit.log({
      actorId,
      action: SECURITY_ACTIONS.LOCKDOWN_ACTIVATED,
      entityType: ENTITY_TYPES.SECURITY_EVENT,
      metadata: {
        mode: SecurityMode.LOCKDOWN,
        timestamp: new Date().toISOString(),
        revokedOtps: true,
        clearedSessions: true,
      },
    });
  }

  /**
   * Deactivate lockdown mode and return to production.
   */
  async deactivateLockdown(actorId: string): Promise<void> {
    const cfg = SecurityConfig.getInstance();
    await cfg.set("SECURITY_MODE", SecurityMode.PRODUCTION, actorId);

    const audit = getAuditService();
    await audit.log({
      actorId,
      action: SECURITY_ACTIONS.LOCKDOWN_DEACTIVATED,
      entityType: ENTITY_TYPES.SECURITY_EVENT,
      metadata: {
        mode: SecurityMode.PRODUCTION,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Disable all paper downloads across the system.
   * Does NOT change the mode — just disables downloads.
   */
  async disableDownloads(actorId: string): Promise<void> {
    const cfg = SecurityConfig.getInstance();
    await cfg.set("DOWNLOADS_ENABLED", "false", actorId);

    const audit = getAuditService();
    await audit.log({
      actorId,
      action: SECURITY_ACTIONS.DOWNLOAD_DISABLED,
      entityType: ENTITY_TYPES.SECURITY_EVENT,
      metadata: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * Re-enable downloads.
   */
  async enableDownloads(actorId: string): Promise<void> {
    const cfg = SecurityConfig.getInstance();
    await cfg.set("DOWNLOADS_ENABLED", "true", actorId);

    const audit = getAuditService();
    await audit.log({
      actorId,
      action: "DOWNLOADS_ENABLED",
      entityType: ENTITY_TYPES.SECURITY_EVENT,
      metadata: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * Revoke ALL active OTPs for a specific user (or all users if userId omitted).
   */
  async revokeOtps(actorId: string, userId?: string): Promise<number> {
    const where: Record<string, unknown> = {
      usedAt: null,
      expiresAt: { gt: new Date() },
    };
    if (userId) where.userId = userId;

    const result = await prisma.otpCode.updateMany({
      where: where as any,
      data: { expiresAt: new Date(0) },
    });

    const audit = getAuditService();
    await audit.log({
      actorId,
      action: "OTPS_REVOKED",
      entityType: ENTITY_TYPES.OTP_CODE,
      metadata: {
        userId: userId ?? "all",
        count: result.count,
        timestamp: new Date().toISOString(),
      },
    });

    return result.count;
  }
}

let emergencyServiceInstance: EmergencyService | null = null;
export function getEmergencyService(): EmergencyService {
  if (!emergencyServiceInstance) {
    emergencyServiceInstance = new EmergencyService();
  }
  return emergencyServiceInstance;
}
