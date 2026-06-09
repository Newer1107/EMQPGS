import { cookies } from "next/headers";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { authCookieNames, signAccessToken, signRefreshToken } from "@/lib/jwt";
import { UserService } from "@/modules/users/service";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/api-context";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const POST = withApiHandler(async (request) => {
  const payload = loginSchema.parse(await parseJson(request));
  const user = await new UserService().verifyCredentials(payload.email, payload.password);

  const tokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    departmentId: user.departmentId,
  };

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(tokenPayload),
    signRefreshToken(tokenPayload),
  ]);

  const cookieStore = await cookies();
  cookieStore.set(authCookieNames.access, accessToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 15 });
  cookieStore.set(authCookieNames.refresh, refreshToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7 });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const meta = await getRequestMeta();
  await logAudit({
    actorId: user.id,
    action: "LOGIN",
    entityType: "AUTH",
    entityId: user.id,
    metadata: { email: user.email, role: user.role },
    ...meta,
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department?.name ?? null,
    },
  };
});
