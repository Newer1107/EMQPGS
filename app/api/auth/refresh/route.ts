import { cookies } from "next/headers";
import { withApiHandler } from "@/lib/api-handler";
import { authCookieNames, signAccessToken, verifyRefreshToken } from "@/lib/jwt";
import { UserService } from "@/modules/users/service";
import { UnauthorizedError } from "@/lib/errors";
import { env } from "@/lib/env";

export const POST = withApiHandler(async () => {
  const cookieStore = await cookies();
  const refresh = cookieStore.get(authCookieNames.refresh)?.value;
  if (!refresh) throw new UnauthorizedError();
  let verified;
  try {
    verified = await verifyRefreshToken(refresh);
  } catch {
    throw new UnauthorizedError("Session expired");
  }
  const user = await new UserService().findByEmail(verified.payload.email as string);
  if (!user) throw new UnauthorizedError();

  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    departmentId: user.departmentId,
  });

  cookieStore.set(authCookieNames.access, accessToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * env.ACCESS_TOKEN_TTL_MINUTES });
  return { message: "Refreshed" };
});
