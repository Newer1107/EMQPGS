import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ResponsibilityResolver } from "@/lib/auth/responsibility-resolver";
import { AuthorizationService } from "@/lib/auth/authorization-service";
import { redirect } from "next/navigation";
import type { ResponsibilityType } from "@prisma/client";

export default async function DeanLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserFromCookies();
  const resolver = new ResponsibilityResolver();
  const auth = await resolver.resolveAsContext(user.id, user);
  const authz = new AuthorizationService(auth);

  if (!authz.has("DEAN" as ResponsibilityType)) {
    redirect("/dashboard");
  }

  return children;
}
