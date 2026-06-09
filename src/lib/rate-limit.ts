import { createHash } from "node:crypto";
import { env } from "@/lib/env";
import { redis } from "@/lib/redis";
import { AppError } from "@/lib/errors";

export async function enforceRateLimit(keyParts: string[]) {
  const digest = createHash("sha256").update(keyParts.join(":")).digest("hex");
  const key = `rate-limit:${digest}`;
  const windowSeconds = env.RATE_LIMIT_WINDOW_SECONDS;
  const maxRequests = env.RATE_LIMIT_MAX_REQUESTS;

  try {
    await redis.connect().catch(() => undefined);
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    if (count > maxRequests) {
      throw new AppError("Rate limit exceeded", 429, "RATE_LIMIT_EXCEEDED");
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
  }
}
