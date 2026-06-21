import { getCurrentUserFromCookies } from "@/lib/api-context";
import { AppShell } from "@/components/layout/app-shell";
import { ResponsibilityResolver } from "@/lib/auth/responsibility-resolver";
import { ActiveWorkspaceService } from "@/lib/auth/active-workspace";
import { WorkspaceDisplayResolver } from "@/lib/auth/workspace-display";
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
  const displayResolver = new WorkspaceDisplayResolver();
  const responsibilities = await resolver.resolve(actor.id);
  const resolvedDisplays = await Promise.all(
    responsibilities.map(async (r) => ({
      id: r.id,
      display: await displayResolver.resolve(r.type, r.scopeType, r.scopeId),
    })),
  );

  const aws = new ActiveWorkspaceService();
  const activeWs = await aws.resolve(actor.id);

  return (
    <AppShell
      userName={name!}
      userEmail={email!}
      workspaceType={activeWs?.responsibility ?? ""}
      workspaceTitle={activeWs?.display.title}
      workspaceSubtitle={activeWs?.display.subtitle}
      workspaceTertiary={activeWs?.display.tertiary}
      activeAssignmentId={activeWs?.assignmentId}
      responsibilities={resolvedDisplays}
    >
      {children}
    </AppShell>
  );
}
