import { cookies } from "next/headers";
import { withApiHandler } from "@/lib/api-handler";

import { authCookieNames, signAccessToken, signRefreshToken } from "@/lib/jwt";
import { UserService } from "@/modules/users/service";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/api-context";
import { env } from "@/lib/env";
import { getOrCreateCsrfToken } from "@/lib/csrf";
import { ResponsibilityResolver } from "@/lib/auth/responsibility-resolver";
import { WorkspaceCookieManager } from "@/lib/auth/workspace-cookie-manager";
import { WorkspaceSelector } from "@/lib/auth/workspace-selector";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const POST = withApiHandler(async (request) => {
  const payload = loginSchema.parse(await request.json());
  const user = await new UserService().verifyCredentials(payload.email, payload.password);

  const tokenPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    homeDepartmentId: user.homeDepartmentId,
  };

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(tokenPayload),
    signRefreshToken(tokenPayload),
  ]);

  const cookieStore = await cookies();
  cookieStore.set(authCookieNames.access, accessToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * env.ACCESS_TOKEN_TTL_MINUTES });
  cookieStore.set(authCookieNames.refresh, refreshToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * env.REFRESH_TOKEN_TTL_DAYS });
  await getOrCreateCsrfToken();

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const meta = await getRequestMeta();
  await logAudit({
    actorId: user.id,
    action: "LOGIN",
    entityType: "AUTH",
    entityId: user.id,
    metadata: { email: user.email },
    ...meta,
  });

  const resolver = new ResponsibilityResolver();
  const responsibilities = await resolver.resolve(user.id);
  const selector = new WorkspaceSelector();
  const picked = await selector.pickDefaultForUser(user.id);

  if (picked) {
    await new WorkspaceCookieManager().set(picked.assignmentId);
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      homeDepartment: user.homeDepartment?.name ?? null,
    },
    responsibilities: responsibilities.map((r) => ({
      id: r.id,
      type: r.type,
      scopeType: r.scopeType,
      scopeId: r.scopeId,
    })),
    redirectTo: picked
      ? `/dashboard/${picked.responsibility.toLowerCase()}`
      : responsibilities.length > 0
        ? "/workspace-select"
        : "/no-access",
  };
});
