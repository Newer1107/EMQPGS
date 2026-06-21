import { cookies, headers } from "next/headers";
import { UserService } from "@/modules/users/service";
import { UnauthorizedError } from "@/lib/errors";
import { authCookieNames, verifyAccessToken } from "@/lib/jwt";

export async function getCurrentUserFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(authCookieNames.access)?.value;
  if (!token) throw new UnauthorizedError();
  const verified = await verifyAccessToken(token);
  const user = await new UserService().findByEmail(verified.payload.email as string);
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function getRequestMeta() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  const realIp = headerStore.get("x-real-ip");

  // Trust proxy IP: if behind a reverse proxy, use x-forwarded-for first
  // Falls back to x-real-ip, then to null
  const ipAddress = forwardedFor?.split(",")[0]?.trim() ?? realIp ?? null;

  return {
    ipAddress,
    userAgent: headerStore.get("user-agent") ?? null,
  };
}

/**
 * Extract the JWT's JTI (token ID) from the current access token cookie.
 * Used for binding OTP/step-up sessions to a specific token/session.
 */
export async function getCurrentSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(authCookieNames.access)?.value;
  if (!token) return null;
  try {
    const verified = await verifyAccessToken(token);
    return (verified.payload as Record<string, unknown>).jti as string ?? null;
  } catch {
    return null;
  }
}
