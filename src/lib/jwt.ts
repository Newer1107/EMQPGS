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
    .setExpirationTime("15m")
    .sign(accessSecret);
}

export async function signRefreshToken(payload: Omit<TokenPayload, "type">) {
  return new SignJWT({ ...payload, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(refreshSecret);
}

export async function verifyAccessToken(token: string) {
  return jwtVerify(token, accessSecret);
}

export async function verifyRefreshToken(token: string) {
  return jwtVerify(token, refreshSecret);
}

export const authCookieNames = {
  access: ACCESS_COOKIE,
  refresh: REFRESH_COOKIE,
};
