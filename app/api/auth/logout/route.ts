import { cookies } from "next/headers";
import { withApiHandler } from "@/lib/api-handler";
import { authCookieNames, blacklistToken } from "@/lib/jwt";
import { CSRF_COOKIE } from "@/lib/constants";

export const POST = withApiHandler(async (request, context) => {
  const cookieStore = await cookies();
  const token = cookieStore.get(authCookieNames.access)?.value;
  if (token) {
    try {
      const { verifyAccessToken } = await import("@/lib/jwt");
      const payload = await verifyAccessToken(token);
      if (payload.payload?.jti) {
        await blacklistToken(payload.payload.jti, "access");
      }
    } catch {
      // Token already invalid — skip blacklisting
    }
  }
  cookieStore.delete(authCookieNames.access);
  cookieStore.delete(authCookieNames.refresh);
  cookieStore.delete(CSRF_COOKIE);
  return { message: "Logged out" };
}, { audit: { action: "LOGOUT", entityType: "AUTH" } });
