import crypto from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { env } from "@/lib/env";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/constants";
import { prisma } from "@/lib/db";

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

export type TokenPayload = {
  sub: string;
  email: string;
  role: string;
  name: string;
  departmentId?: string | null;
  type: "access" | "refresh";
};

export async function signAccessToken(payload: Omit<TokenPayload, "type">) {
  return new SignJWT({ ...payload, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_MINUTES}m`)
    .sign(accessSecret);
}

export async function signRefreshToken(payload: Omit<TokenPayload, "type">) {
  return new SignJWT({ ...payload, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${env.REFRESH_TOKEN_TTL_DAYS}d`)
    .sign(refreshSecret);
}

export async function blacklistToken(jti: string, type: "access" | "refresh") {
  const ttlMinutes = type === "access"
    ? Number(env.ACCESS_TOKEN_TTL_MINUTES ?? 15)
    : Number(env.REFRESH_TOKEN_TTL_DAYS ?? 7) * 24 * 60;

  await prisma.revokedToken.create({
    data: {
      jti,
      type,
      expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
    },
  }).catch(() => {
    // Best-effort: if blacklisting fails, tokens still expire naturally
  });
}

export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  const found = await prisma.revokedToken.findUnique({ where: { jti } });
  return found !== null;
}

export async function verifyAccessToken(token: string) {
  const verified = await jwtVerify(token, accessSecret);
  const jti = verified.payload.jti as string | undefined;
  if (jti) {
    const blacklisted = await isTokenBlacklisted(jti);
    if (blacklisted) throw new Error("Token has been revoked");
  }
  return verified;
}

export async function verifyRefreshToken(token: string) {
  const verified = await jwtVerify(token, refreshSecret);
  const jti = verified.payload.jti as string | undefined;
  if (jti) {
    const blacklisted = await isTokenBlacklisted(jti);
    if (blacklisted) throw new Error("Token has been revoked");
  }
  const issuedAt = verified.payload.iat;
  if (typeof issuedAt === "number") {
    const idleTimeoutSeconds = env.SESSION_IDLE_TIMEOUT_MINUTES * 60;
    if (Date.now() / 1000 - issuedAt > idleTimeoutSeconds) {
      throw new Error("Session idle timeout exceeded");
    }
  }
  return verified;
}

export const authCookieNames = {
  access: ACCESS_COOKIE,
  refresh: REFRESH_COOKIE,
};
