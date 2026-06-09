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
  return {
    ipAddress: headerStore.get("x-forwarded-for") ?? null,
    userAgent: headerStore.get("user-agent") ?? null,
  };
}
