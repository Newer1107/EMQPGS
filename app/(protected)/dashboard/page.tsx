import { redirect } from "next/navigation";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ResponsibilityResolver } from "@/lib/auth/responsibility-resolver";
import { ActiveWorkspaceResolver } from "@/lib/auth/workspace-resolver";
import { WorkspaceSelector } from "@/lib/auth/workspace-selector";

export default async function DashboardIndexPage() {
  const user = await getCurrentUserFromCookies();
  const resolver = new ActiveWorkspaceResolver();
  const active = await resolver.resolve(user.id);
  if (active) {
    redirect(`/dashboard/${active.responsibility.toLowerCase()}`);
  }

  const responsibilityResolver = new ResponsibilityResolver();
  const responsibilities = await responsibilityResolver.resolve(user.id);

  if (responsibilities.length === 0) redirect("/no-access");
  if (responsibilities.length === 1) {
    redirect(`/api/auth/workspace?assignmentId=${responsibilities[0].id}`);
  }

  const selector = new WorkspaceSelector();
  const picked = await selector.pickDefaultForUser(user.id);
  if (picked) {
    redirect(`/api/auth/workspace?assignmentId=${picked.assignmentId}`);
  }

  redirect("/workspace-select");
}