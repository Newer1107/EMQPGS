import { env } from "@/lib/env";
import { SecurityConfig } from "@/lib/auth/security-config";
import { logAudit } from "@/lib/audit";
import { SECURITY_ACTIONS, ENTITY_TYPES } from "@/lib/constants";
import { AppError } from "@/lib/errors";
import {
  type StepUpStore,
  type StepUpEntry,
  getDefaultStepUpStore,
} from "@/lib/auth/step-up-store";

export const STEP_UP_ACTIONS = {
  DEAN_REVEAL: { action: "DEAN_REVEAL", roles: ["DEAN"] as const },
  DEAN_APPROVE: { action: "DEAN_APPROVE", roles: ["DEAN"] as const },
  COE_DOWNLOAD: { action: "COE_DOWNLOAD", roles: ["COE"] as const },
  COE_MARK_USED: { action: "COE_MARK_USED", roles: ["COE"] as const },
  COE_ARCHIVE: { action: "COE_ARCHIVE", roles: ["COE"] as const },
  DEAN_DOWNLOAD: { action: "DEAN_DOWNLOAD", roles: ["DEAN"] as const },
} as const;

export type StepUpAction = (typeof STEP_UP_ACTIONS)[keyof typeof STEP_UP_ACTIONS]["action"];

/**
 * Step-Up Session Manager.
 * Uses a pluggable StepUpStore (default: MemoryStepUpStore).
 * Verifies: user + action + resource + browser fingerprint.
 */
export class StepUpService {
  private readonly store: StepUpStore;
  private readonly ttlMs: number;

  constructor(store?: StepUpStore) {
    this.store = store ?? getDefaultStepUpStore();
    this.ttlMs = env.STEP_UP_TTL_SECONDS * 1000;
  }

  private key(userId: string, action: string, resourceId?: string, fingerprint?: string): string {
    const fp = fingerprint ?? "";
    return resourceId ? `${userId}:${action}:${resourceId}:${fp}` : `${userId}:${action}:${fp}`;
  }

  private userPrefix(userId: string): string {
    return `${userId}:`;
  }

  async setVerified(
    userId: string,
    action: string,
    resourceId?: string,
    browserFingerprint?: string,
  ): Promise<void> {
    const cfg = SecurityConfig.getInstance();
    const ttl = cfg.isAutoApproved ? 24 * 60 * 60 * 1000 : this.ttlMs;
    const entry: StepUpEntry = {
      verifiedAt: Date.now(),
      ttlMs: ttl,
      ...(browserFingerprint ? { browserFingerprint } : {}),
    };
    await this.store.set(this.key(userId, action, resourceId, browserFingerprint), entry);
  }

  async requireVerified(
    userId: string,
    action: string,
    resourceId?: string,
    browserFingerprint?: string,
    securityEventId?: string,
  ): Promise<void> {
    const cfg = SecurityConfig.getInstance();
    if (cfg.isAutoApproved) return;

    const key = this.key(userId, action, resourceId, browserFingerprint);
    const entry = await this.store.get(key);

    if (!entry) {
      throw new AppError("Step-up authentication required. Request an OTP first.", 401, "STEP_UP_REQUIRED");
    }

    if (Date.now() - entry.verifiedAt > entry.ttlMs) {
      await this.store.delete(key);
      logAudit({
        actorId: userId, action: SECURITY_ACTIONS.STEP_UP_SESSION_EXPIRED,
        entityType: ENTITY_TYPES.SECURITY_EVENT, securityEventId, metadata: { action, resourceId },
      }).catch(() => {});
      throw new AppError("Step-up session expired. Request a new OTP.", 401, "STEP_UP_EXPIRED");
    }

    if (entry.browserFingerprint && browserFingerprint && entry.browserFingerprint !== browserFingerprint) {
      await this.store.delete(key);
      logAudit({
        actorId: userId, action: "STEP_UP_FINGERPRINT_MISMATCH",
        entityType: ENTITY_TYPES.SECURITY_EVENT, securityEventId, metadata: { action, resourceId },
      }).catch(() => {});
      throw new AppError("Step-up session is bound to a different browser. Request a new OTP.", 401, "STEP_UP_FINGERPRINT_MISMATCH");
    }
  }

  async isVerified(
    userId: string,
    action: string,
    resourceId?: string,
    browserFingerprint?: string,
  ): Promise<boolean> {
    const cfg = SecurityConfig.getInstance();
    if (cfg.isAutoApproved) return true;

    const key = this.key(userId, action, resourceId, browserFingerprint);
    const entry = await this.store.get(key);
    if (!entry) return false;
    if (Date.now() - entry.verifiedAt > entry.ttlMs) {
      await this.store.delete(key);
      return false;
    }
    if (entry.browserFingerprint && browserFingerprint && entry.browserFingerprint !== browserFingerprint) {
      await this.store.delete(key);
      return false;
    }
    return true;
  }

  async clear(userId: string, action?: string, resourceId?: string, browserFingerprint?: string): Promise<void> {
    if (action && resourceId && browserFingerprint) {
      await this.store.delete(this.key(userId, action, resourceId, browserFingerprint));
    } else if (action && resourceId) {
      await this.store.deleteByPrefix(`${userId}:${action}:${resourceId}:`);
    } else if (action) {
      await this.store.deleteByPrefix(`${userId}:${action}:`);
    } else {
      await this.store.deleteByPrefix(this.userPrefix(userId));
    }
  }

  async clearAll(): Promise<void> {
    await this.store.clear();
  }

  async getActiveSessions(
    userId: string,
  ): Promise<Array<{ action: string; resourceId?: string; verifiedAt: Date }>> {
    const entries = await this.store.entries(this.userPrefix(userId));
    return entries.map(({ key, entry }) => {
      const parts = key.split(":");
      return { action: parts[1], resourceId: parts[2], verifiedAt: new Date(entry.verifiedAt) };
    });
  }
}
