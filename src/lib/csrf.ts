import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { env } from "@/lib/env";
import { CSRF_COOKIE } from "@/lib/constants";
import { ForbiddenError } from "@/lib/errors";

export async function getOrCreateCsrfToken() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(CSRF_COOKIE)?.value;
  if (existing) return existing;

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

export async function assertCsrfProtection(method: string) {
  if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) return;

  const cookieStore = await cookies();
  const headerStore = await headers();
  const cookieToken = cookieStore.get(CSRF_COOKIE)?.value;
  const headerToken = headerStore.get("x-csrf-token");
  const origin = headerStore.get("origin");
  const host = headerStore.get("host");

  if (!cookieToken || !headerToken || cookieToken !== headerToken || !verifyCsrfToken(cookieToken)) {
    throw new ForbiddenError("Invalid CSRF token");
  }

  if (origin && host) {
    const originHost = new URL(origin).host;
    if (originHost !== host) {
      throw new ForbiddenError("Cross-site request blocked");
    }
  }
}

function signCsrfToken(raw: string) {
  const signature = crypto.createHmac("sha256", env.CSRF_SECRET).update(raw).digest("hex");
  return `${raw}.${signature}`;
}

function verifyCsrfToken(token: string) {
  const [raw, signature] = token.split(".");
  if (!raw || !signature) return false;
  const expected = crypto.createHmac("sha256", env.CSRF_SECRET).update(raw).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
