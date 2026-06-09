import { jwtVerify, SignJWT } from "jose";
import { env } from "@/lib/env";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/constants";

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
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_MINUTES}m`)
    .sign(accessSecret);
}

export async function signRefreshToken(payload: Omit<TokenPayload, "type">) {
  return new SignJWT({ ...payload, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${env.REFRESH_TOKEN_TTL_DAYS}d`)
    .sign(refreshSecret);
}

export async function verifyAccessToken(token: string) {
  return jwtVerify(token, accessSecret);
}

export async function verifyRefreshToken(token: string) {
  const verified = await jwtVerify(token, refreshSecret);
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
