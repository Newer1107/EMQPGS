import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { env } from "@/lib/env";
import { CSRF_COOKIE } from "@/lib/constants";
import { ForbiddenError } from "@/lib/errors";

/** Token format: raw.base36timestamp.signature */
const CSRF_MAX_AGE_MS = 60 * 60 * 24 * 1000;
const CSRF_REFRESH_THRESHOLD_MS = 60 * 60 * 1000;

export async function getOrCreateCsrfToken() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(CSRF_COOKIE)?.value;

  if (existing) {
    const parsed = parseCsrfToken(existing);
    if (parsed && parsed.age < CSRF_MAX_AGE_MS) {
      if (parsed.age > CSRF_MAX_AGE_MS - CSRF_REFRESH_THRESHOLD_MS) {
        return setCsrfCookie();
      }
      return existing;
    }
  }

  return setCsrfCookie();
}

export async function assertCsrfProtection(method: string) {
  if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) return;

  const cookieStore = await cookies();
  const headerStore = await headers();
  const cookieToken = cookieStore.get(CSRF_COOKIE)?.value;
  const headerToken = headerStore.get("x-csrf-token");
  const origin = headerStore.get("origin");

  if (!cookieToken || !headerToken || cookieToken !== headerToken || !verifyCsrfToken(cookieToken)) {
    throw new ForbiddenError("Invalid CSRF token");
  }

  if (origin) {
    const hostHeader = headerStore.get("host");
    if (hostHeader && new URL(origin).host !== hostHeader) {
      throw new ForbiddenError("Cross-site request blocked");
    }
  }
}

function signCsrfToken(raw: string) {
  const timestamp = Date.now().toString(36);
  const signature = crypto.createHmac("sha256", env.CSRF_SECRET).update(`${raw}.${timestamp}`).digest("hex");
  return `${raw}.${timestamp}.${signature}`;
}

function verifyCsrfToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [raw, timestampB36, signature] = parts;
  if (!raw || !timestampB36 || !signature) return false;

  const age = Date.now() - Number.parseInt(timestampB36, 36);
  if (Number.isNaN(age) || age > CSRF_MAX_AGE_MS) return false;

  const expected = crypto.createHmac("sha256", env.CSRF_SECRET).update(`${raw}.${timestampB36}`).digest("hex");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

function parseCsrfToken(token: string): { raw: string; age: number } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [raw, timestampB36] = parts;
  if (!raw || !timestampB36) return null;
  const age = Date.now() - Number.parseInt(timestampB36, 36);
  if (Number.isNaN(age)) return null;
  return { raw, age };
}

async function setCsrfCookie() {
  const cookieStore = await cookies();
  const token = signCsrfToken(crypto.randomBytes(24).toString("hex"));
  cookieStore.set(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return token;
}
