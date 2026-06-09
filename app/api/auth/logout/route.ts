import { cookies } from "next/headers";
import { withApiHandler } from "@/lib/api-handler";
import { authCookieNames } from "@/lib/jwt";

export const POST = withApiHandler(async () => {
  const cookieStore = await cookies();
  cookieStore.delete(authCookieNames.access);
  cookieStore.delete(authCookieNames.refresh);
  return { message: "Logged out" };
}, { audit: { action: "LOGOUT", entityType: "AUTH" } });
