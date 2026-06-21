import { getCurrentUserFromCookies } from "@/lib/api-context";
import { AppShell } from "@/components/layout/app-shell";
import { ResponsibilityResolver } from "@/lib/auth/responsibility-resolver";
import { WorkspaceResolver } from "@/lib/auth/workspace-resolver";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  let workspaceType: string | null = null;
  let name: string | null = null;
  let email: string | null = null;
  try {
    const user = await getCurrentUserFromCookies();
    const resolver = new ResponsibilityResolver();
    const auth = await resolver.resolveAsContext(user.id, user);
    const workspace = new WorkspaceResolver().getFirstWorkspace(auth);
    workspaceType = workspace?.responsibility.type ?? "";
    name = user.name;
    email = user.email;
  } catch {
    redirect("/login");
  }

  const badgeCounts: Record<string, number> = {};

  return <AppShell workspaceType={workspaceType!} userName={name!} userEmail={email!} badgeCounts={badgeCounts}>{children}</AppShell>;
}
