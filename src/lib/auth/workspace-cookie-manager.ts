import { cookies } from "next/headers";
import { ACTIVE_WS_COOKIE } from "@/lib/constants";

/**
 * Manages workspace cookie persistence.
 *
 * This is the ONLY component allowed to mutate workspace cookies.
 * May only be called from Route Handlers, Server Actions, or Middleware.
 * Server Components must never invoke write methods (set, clear).
 */
export class WorkspaceCookieManager {
  async get(): Promise<string | null> {
    const cookieStore = await cookies();
    return cookieStore.get(ACTIVE_WS_COOKIE)?.value ?? null;
  }

  async set(assignmentId: string): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_WS_COOKIE, assignmentId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  async clear(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_WS_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }
}
