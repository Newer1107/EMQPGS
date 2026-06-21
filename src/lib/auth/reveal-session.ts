import { SecurityConfig } from "@/lib/auth/security-config";
import { AppError } from "@/lib/errors";

type RevealSession = {
  userId: string;
  paperIds: string[];
  revealedAt: number;
  ttlMs: number;
};

/**
 * Paper Reveal Session Manager.
 *
 * Viewing a generated paper should not grant indefinite access.
 * After PAPER_REVEAL_TIMEOUT_MINUTES (default 10), the paper auto-blurs.
 * Fresh step-up required to re-reveal.
 *
 * In-memory Map — sessions lost on restart (forces re-reveal).
 * Upgrade path: shared store (Redis) for multi-process.
 */
export class RevealSessionManager {
  private readonly sessions = new Map<string, RevealSession>();
  private readonly ttlMs: number;
  private writeCount = 0;

  constructor() {
    this.ttlMs =
      (parseInt(process.env.PAPER_REVEAL_TIMEOUT_MINUTES ?? "10", 10)) * 60 * 1000;
  }

  // ─── Key helpers ────────────────────────────────────────────────────────

  private paperKey(userId: string, paperId: string): string {
    return `${userId}:${paperId}`;
  }

  private userPrefix(userId: string): string {
    return `${userId}:`;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  /**
   * Start a reveal session. Called after step-up verification for paper reveal.
   * In dev mode: long TTL (24h).
   */
  startReveal(userId: string, paperIds: string[]): void {
    const cfg = SecurityConfig.getInstance();
    const ttlMs = cfg.isAutoApproved ? 24 * 60 * 60 * 1000 : this.ttlMs;

    const session: RevealSession = {
      userId,
      paperIds,
      revealedAt: Date.now(),
      ttlMs,
    };

    for (const paperId of paperIds) {
      this.sessions.set(this.paperKey(userId, paperId), session);
    }

    this.writeCount++;
    if (this.writeCount >= 100) {
      this.prune();
      this.writeCount = 0;
    }
  }

  /**
   * Check if a reveal session is still valid.
   * @throws AppError with REVEAL_EXPIRED if the session has expired.
   */
  requireRevealValid(userId: string, paperId: string): void {
    if (!this.isRevealValid(userId, paperId)) {
      throw new AppError(
        "Paper reveal session has expired. Request a new OTP to re-reveal.",
        401,
        "REVEAL_EXPIRED",
      );
    }
  }

  /**
   * Check if a reveal is still valid (boolean).
   */
  isRevealValid(userId: string, paperId: string): boolean {
    const key = this.paperKey(userId, paperId);
    const session = this.sessions.get(key);
    if (!session) return false;

    if (Date.now() - session.revealedAt > session.ttlMs) {
      this.sessions.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get remaining time in seconds for a reveal session.
   * Returns 0 if the session does not exist or has expired.
   */
  getRemainingSeconds(userId: string, paperId: string): number {
    const key = this.paperKey(userId, paperId);
    const session = this.sessions.get(key);
    if (!session) return 0;

    const elapsed = Date.now() - session.revealedAt;
    const remaining = Math.max(0, session.ttlMs - elapsed);
    return Math.floor(remaining / 1000);
  }

  /**
   * End a reveal session early.
   */
  endReveal(userId: string, paperId?: string): void {
    if (paperId) {
      this.sessions.delete(this.paperKey(userId, paperId));
    } else {
      // Remove all sessions for this user
      const prefix = this.userPrefix(userId);
      for (const key of this.sessions.keys()) {
        if (key.startsWith(prefix)) {
          this.sessions.delete(key);
        }
      }
    }
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  /** Remove expired sessions. Called automatically every 100 writes. */
  private prune(): void {
    const now = Date.now();
    for (const [key, session] of this.sessions.entries()) {
      if (now - session.revealedAt > session.ttlMs) {
        this.sessions.delete(key);
      }
    }
  }
}

/** Singleton accessor */
let instance: RevealSessionManager | null = null;
export function getRevealSessionManager(): RevealSessionManager {
  if (!instance) {
    instance = new RevealSessionManager();
  }
  return instance;
}
