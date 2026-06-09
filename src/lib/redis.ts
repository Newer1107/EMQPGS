import Redis from "ioredis";
import { env } from "@/lib/env";

declare global {
  var redis: Redis | undefined;
}

export const redis =
  global.redis ??
  new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

if (process.env.NODE_ENV !== "production") {
  global.redis = redis;
}
