import { getCurrentUserFromCookies } from "@/lib/api-context";
import { AppShell } from "@/components/layout/app-shell";
import { ResponsibilityResolver } from "@/lib/auth/responsibility-resolver";
import { ActiveWorkspaceService } from "@/lib/auth/active-workspace";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  let name: string | null = null;
  let email: string | null = null;
  let actor;
  try {
    actor = await getCurrentUserFromCookies();
    name = actor.name;
    email = actor.email;
  } catch {
    redirect("/login");
  }

  const resolver = new ResponsibilityResolver();
  const responsibilities = await resolver.resolve(actor.id);

  const aws = new ActiveWorkspaceService();
  const activeWs = await aws.resolve(actor.id);
  const wsDisplayName = activeWs?.displayName ?? "";
  const scopeParts = wsDisplayName.split("·").slice(1).join("·").trim();

  return (
    <AppShell
      userName={name!}
      userEmail={email!}
      workspaceType={activeWs?.responsibility ?? ""}
      workspaceScope={scopeParts || undefined}
      activeAssignmentId={activeWs?.assignmentId}
      responsibilities={responsibilities.map((r) => ({
        id: r.id,
        type: r.type,
        scopeType: r.scopeType,
        scopeId: r.scopeId,
      }))}
    >
      {children}
    </AppShell>
  );
}
