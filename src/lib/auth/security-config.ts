import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { logAudit } from "@/lib/audit";

/**
 * Security modes for the EMQPGS platform.
 *
 * - development:  Pipeline executes, verification auto-approved. No OTP/watermarks/confirmation.
 * - production:   Full security enforcement. OTP, step-up, watermarks, typed confirmation, audit.
 * - lockdown:     Reserved. Disables downloads, reveals, revokes active OTPs, requires re-auth.
 */
export enum SecurityMode {
  DEVELOPMENT = "development",
  PRODUCTION = "production",
  LOCKDOWN = "lockdown",
}

/** Runtime feature flags derived from the active security mode. */
export type SecurityFeatures = {
  readonly otpRequired: boolean;
  readonly stepUpRequired: boolean;
  readonly browserWatermark: boolean;
  readonly docxWatermark: boolean;
  readonly typedConfirmation: boolean;
  readonly noCacheHeaders: boolean;
  readonly downloadsEnabled: boolean;
  readonly paperRevealEnabled: boolean;
  readonly auditLogging: boolean;
};

/**
 * Centralized security configuration.
 *
 * PRECEDENCE (highest to lowest):
 *   1. Environment variable (SECURITY_MODE env var) — MAXIMUM permitted security level
 *   2. Database overrides (SecurityConfig table) — may ADD restrictions but never WEAKEN
 *   3. Runtime defaults (code defaults) — fallback when nothing else is set
 *
 * TWO-LAYER OVERRIDE:
 *   1. Env var `SECURITY_MODE` (bootstrap) — development | production | lockdown
 *   2. `SecurityConfig` DB table (runtime toggle) — changes are audited
 *
 * RULES:
 *   - Business services MUST NEVER inspect `process.env` or `env.NODE_ENV` directly.
 *   - Every security component queries this class.
 *   - Every toggle change is logged to AuditLog.
 *   - Development mode: pipeline executes, only the VERIFICATION step is bypassed.
 *     No duplicate code paths. No special developer APIs.
 */
export class SecurityConfig {
  private static instance: SecurityConfig | null = null;

  private constructor() {}

  static getInstance(): SecurityConfig {
    if (!SecurityConfig.instance) {
      SecurityConfig.instance = new SecurityConfig();
    }
    return SecurityConfig.instance;
  }

  /** Reset singleton (for testing only). */
  static resetInstance(): void {
    SecurityConfig.instance = null;
  }

  // ─── Bootstrap mode from env ────────────────────────────────────────────

  /** Read the bootstrap security mode from env (never cached — reflects current env). */
  get mode(): SecurityMode {
    const raw = env.SECURITY_MODE;
    switch (raw) {
      case "production":
        return SecurityMode.PRODUCTION;
      case "lockdown":
        return SecurityMode.LOCKDOWN;
      default:
        return SecurityMode.DEVELOPMENT;
    }
  }

  // ─── Effective mode (env + DB) ──────────────────────────────────────────

  /**
   * Get the effective security mode.
   * Env var defines the FLOOR (minimum allowed mode).
   * DB can only INCREASE restrictions, never decrease below env.
   */
  async getEffectiveMode(): Promise<SecurityMode> {
    const envMode = this.mode;
    const dbOverride = await this.get("SECURITY_MODE");
    if (!dbOverride) return envMode;

    // DB can never weaken the env-defined security level
    const envPriority = { development: 0, production: 1, lockdown: 2 };
    const dbPriority = envPriority[dbOverride as keyof typeof envPriority] ?? 0;

    // Return the MORE restrictive of the two
    return dbPriority > envPriority[envMode] ? (dbOverride as SecurityMode) : envMode;
  }

  // ─── DB override layer ──────────────────────────────────────────────────

  /**
   * Read a runtime config value. Falls back to env var, then to default.
   * DB overrides take precedence over env.
   */
  async get(key: string): Promise<string | null> {
    try {
      const row = await prisma.securityConfig.findUnique({ where: { key } });
      return row?.value ?? null;
    } catch {
      // DB unavailable — fall through to env/default
      return null;
    }
  }

  /**
   * Set a runtime config value. The change is audited.
   * Pass `actorId` to attribute the change to a specific user.
   */
  async set(key: string, value: string, actorId?: string): Promise<void> {
    await prisma.securityConfig.upsert({
      where: { key },
      update: { value, updatedAt: new Date() },
      create: { key, value },
    });
    await logAudit({
      actorId: actorId ?? null,
      action: "SECURITY_CONFIG_CHANGED",
      entityType: "SECURITY_CONFIG",
      entityId: key,
      metadata: { key, value },
    });
  }

  // ─── Derived features ───────────────────────────────────────────────────

  /** Get the complete feature set for the current mode. */
  getFeatures(modeOverride?: SecurityMode): SecurityFeatures {
    const m = modeOverride ?? this.mode;
    switch (m) {
      case SecurityMode.PRODUCTION:
        return {
          otpRequired: true,
          stepUpRequired: true,
          browserWatermark: true,
          docxWatermark: true,
          typedConfirmation: true,
          noCacheHeaders: true,
          auditLogging: true,
          downloadsEnabled: true,
          paperRevealEnabled: true,
        };
      case SecurityMode.LOCKDOWN:
        return {
          otpRequired: true,
          stepUpRequired: true,
          browserWatermark: true,
          docxWatermark: true,
          typedConfirmation: true,
          noCacheHeaders: true,
          auditLogging: true,
          downloadsEnabled: false,
          paperRevealEnabled: false,
        };
      default: // development
        return {
          otpRequired: false,
          stepUpRequired: false,
          browserWatermark: false,
          docxWatermark: false,
          typedConfirmation: false,
          noCacheHeaders: true,
          auditLogging: true,
          downloadsEnabled: true,
          paperRevealEnabled: true,
        };
    }
  }

  /** True if the current mode auto-verifies OTP/step-up (development). */
  get isAutoApproved(): boolean {
    return this.mode === SecurityMode.DEVELOPMENT;
  }

  // ─── Convenience checks ─────────────────────────────────────────────────

  isOtpRequired(features?: SecurityFeatures): boolean {
    return (features ?? this.getFeatures()).otpRequired;
  }

  isStepUpRequired(features?: SecurityFeatures): boolean {
    return (features ?? this.getFeatures()).stepUpRequired;
  }

  isDownloadEnabled(features?: SecurityFeatures): boolean {
    return (features ?? this.getFeatures()).downloadsEnabled;
  }

  isPaperRevealEnabled(features?: SecurityFeatures): boolean {
    return (features ?? this.getFeatures()).paperRevealEnabled;
  }
}

/**
 * Convenience guard that throws if the current mode disallows the feature.
 * Used in route handlers before sensitive operations.
 */
export function requireFeatureEnabled(feature: keyof SecurityFeatures): void {
  const cfg = SecurityConfig.getInstance();
  const features = cfg.getFeatures();
  if (!features[feature]) {
    throw new AppError(
      `This action is disabled in ${cfg.mode} mode`,
      403,
      "FEATURE_DISABLED",
    );
  }
}

/**
 * Get an HTTP-friendly label for the current security mode.
 */
export function getSecurityModeLabel(mode?: SecurityMode): string {
  const m = mode ?? SecurityConfig.getInstance().mode;
  switch (m) {
    case SecurityMode.DEVELOPMENT:
      return "Development — security verifications auto-approved";
    case SecurityMode.PRODUCTION:
      return "Production — full security enforcement";
    case SecurityMode.LOCKDOWN:
      return "Lockdown — sensitive actions restricted";
  }
}
