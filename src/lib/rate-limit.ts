import { createHash } from "node:crypto";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

declare global {
  var rateLimitStore: Map<string, { count: number; expiresAt: number }> | undefined;
}

const rateLimitStore = global.rateLimitStore ?? new Map<string, { count: number; expiresAt: number }>();
global.rateLimitStore = rateLimitStore;

export async function enforceRateLimit(keyParts: string[]) {
  const digest = createHash("sha256").update(keyParts.join(":")).digest("hex");
  const key = `rate-limit:${digest}`;
  const windowSeconds = env.RATE_LIMIT_WINDOW_SECONDS;
  const maxRequests = env.RATE_LIMIT_MAX_REQUESTS;
  const now = Date.now();
  const expiresAt = now + windowSeconds * 1000;

  pruneExpiredEntries(now);

  const existing = rateLimitStore.get(key);
  if (!existing || existing.expiresAt <= now) {
    rateLimitStore.set(key, { count: 1, expiresAt });
    return;
  }

  existing.count += 1;
  if (existing.count > maxRequests) {
    throw new AppError("Rate limit exceeded", 429, "RATE_LIMIT_EXCEEDED");
  }
}

function pruneExpiredEntries(now: number) {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.expiresAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}
