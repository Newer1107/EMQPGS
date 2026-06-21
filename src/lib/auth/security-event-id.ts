import crypto from "node:crypto";

/**
 * SecurityEventId — correlation identifier for security workflows.
 *
 * Every operation triggered from one security workflow shares the same ID.
 * This allows reconstructing an entire workflow from a single identifier.
 *
 * Example workflow sharing the same SecurityEventId:
 *   OTP Requested (audit)      ─┐
 *   OTP Verified (audit)        ├── same eventId
 *   Paper Download (audit)      ┘
 *   PaperDownload (DB record)
 *
 * Do NOT rely solely on timestamps — use this ID.
 */
export type SecurityEventId = string;

/**
 * Generate a new SecurityEventId (UUIDv4).
 */
export function generateSecurityEventId(): SecurityEventId {
  return crypto.randomUUID();
}
