import { getCurrentUserFromCookies, getCurrentSessionId } from "@/lib/api-context";
import { AppShell } from "@/components/layout/app-shell";
import { ResponsibilityResolver } from "@/lib/auth/responsibility-resolver";
import { ActiveWorkspaceResolver } from "@/lib/auth/workspace-resolver";
import { WorkspaceDisplayResolver } from "@/lib/auth/workspace-display";
import { WatermarkOverlay } from "@/components/auth/watermark-overlay";
import { DevSecurityBanner } from "@/components/auth/dev-security-banner";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  let name: string | null = null;
  let email: string | null = null;
  let actor;
  let sessionId: string | null = null;
  try {
    actor = await getCurrentUserFromCookies();
    name = actor.name;
    email = actor.email;
    sessionId = await getCurrentSessionId();
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

  const wsResolver = new ActiveWorkspaceResolver();
  const activeWs = await wsResolver.resolve(actor.id);

  const role = activeWs?.responsibility ?? "UNKNOWN";

  return (
    <>
      <DevSecurityBanner />
      <WatermarkOverlay
        userName={name!}
        userEmail={email!}
        userRole={role}
        sessionId={sessionId ?? ""}
      >
      <AppShell
        userName={name!}
        userEmail={email!}
        workspaceType={role}
        workspaceTitle={activeWs?.display.title}
        workspaceSubtitle={activeWs?.display.subtitle}
        workspaceTertiary={activeWs?.display.tertiary}
        activeAssignmentId={activeWs?.assignmentId}
        responsibilities={resolvedDisplays}
      >
        {children}
      </AppShell>
    </WatermarkOverlay>
    </>
  );
}
